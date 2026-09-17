import "server-only";

import { prisma } from "./prisma";

/**
 * Fixed-window rate limiting, backed by the `ratelimit` table.
 *
 * Postgres rather than Redis or an in-process Map: the app already has a pooled Postgres
 * connection, a Map only counts within a single serverless instance (so on Vercel an attacker
 * gets one bucket per lambda), and adding a second datastore for counters this small is not
 * worth the operational cost.
 *
 * The counter is one atomic statement. Reading the row, deciding, then writing would let two
 * concurrent requests both see a count under the limit.
 */

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** 0 when allowed; otherwise seconds until the window expires. */
  retryAfterSeconds: number;
};

/** The limits this app enforces, in one place so they can be tuned together. */
export const RATE_LIMITS = {
  /** PDF extraction buffers 10 MB and parses it, so it is the cheapest thing to abuse. */
  pdfExtract: { limit: 20, windowMs: 60 * 60 * 1000 },
  /** Caps how many fresh guest identities one IP can mint. See `resolveGuest` in lib/auth.ts. */
  guestIssue: { limit: 5, windowMs: 24 * 60 * 60 * 1000 },
  /** Burst guard on the LLM routes. The credit balance is what caps total spend. */
  aiFeature: { limit: 30, windowMs: 10 * 60 * 1000 },
  /** Grading is a DB read, but it is also the only way to read a quiz's answers. */
  quizCheck: { limit: 200, windowMs: 10 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

type CounterRow = { count: number; expiresAt: Date };

/** How long a sweep is trusted before another is attempted, per instance. */
const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAt = 0;

/**
 * Deletes expired counters, at most once a minute per instance.
 *
 * Deliberately fire-and-forget: a failed sweep only means the table keeps rows it would have
 * dropped, which is not worth failing a user's request over.
 */
function sweepExpiredCounters(): void {
  const now = Date.now();
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return;
  lastSweepAt = now;

  void prisma.rateLimit
    .deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
    .catch((error) => {
      console.error("Rate limit sweep failed:", error);
    });
}

/**
 * Counts this request against `key` and reports whether it may proceed.
 *
 * `key` should name both the limit and the subject — `guest-issue:203.0.113.5`,
 * `chat:user_abc` — so unrelated limits never share a bucket.
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, rule.windowMs / 1000);

  // One statement: insert a fresh window, or increment the existing one — resetting the count
  // and window together when the old window has already expired.
  const rows = await prisma.$queryRaw<CounterRow[]>`
    INSERT INTO ratelimit (key, count, "expiresAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}))
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN ratelimit."expiresAt" < now() THEN 1
        ELSE ratelimit.count + 1
      END,
      "expiresAt" = CASE
        WHEN ratelimit."expiresAt" < now() THEN excluded."expiresAt"
        ELSE ratelimit."expiresAt"
      END
    RETURNING count, "expiresAt"
  `;

  sweepExpiredCounters();

  const row = rows[0];

  // Only reachable if the statement returned no row, which the RETURNING clause makes
  // impossible. Throwing beats inventing a verdict that might fail open.
  if (!row) throw new Error("Rate limit counter did not return a row");

  const allowed = row.count <= rule.limit;

  return {
    allowed,
    remaining: Math.max(0, rule.limit - row.count),
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((row.expiresAt.getTime() - Date.now()) / 1000)),
  };
}

/** The 429 for a blocked request, in the `{ message, code }` shape the client already reads. */
export function tooManyRequests(result: RateLimitResult): Response {
  return Response.json(
    {
      message: "Too many requests. Please wait a moment and try again.",
      code: "RATE_LIMITED",
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

/**
 * Checks `key` and returns the 429 to send when it is over the limit, or `null` to proceed.
 * Mirrors `chargeOr402` in lib/api-guard.ts so routes read the same way.
 */
export async function enforceRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<Response | null> {
  const result = await checkRateLimit(key, rule);
  return result.allowed ? null : tooManyRequests(result);
}

/**
 * The caller's IP, or `null` when the platform did not supply one.
 *
 * `x-forwarded-for` is a comma-separated chain whose first entry is the client. It is only
 * trustworthy behind a proxy that overwrites it — Vercel does, so in production this is real.
 * Callers should skip IP-based limits when this returns null rather than sharing one bucket
 * between every unidentified caller.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  return first || headers.get("x-real-ip")?.trim() || null;
}
