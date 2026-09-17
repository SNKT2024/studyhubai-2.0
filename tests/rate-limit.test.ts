import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const deleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: queryRaw,
    rateLimit: { deleteMany },
  },
}));

const { RATE_LIMITS, checkRateLimit, clientIp, enforceRateLimit, tooManyRequests } =
  await import("@/lib/rate-limit");

/** What the counter statement returns for an allowed request. */
function row(count: number, secondsFromNow: number) {
  return [{ count, expiresAt: new Date(Date.now() + secondsFromNow * 1000) }];
}

const rule = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  vi.clearAllMocks();
  deleteMany.mockResolvedValue({ count: 0 });
});

describe("checkRateLimit", () => {
  it("allows a request under the limit and reports the remaining budget", async () => {
    queryRaw.mockResolvedValue(row(1, 60));

    const result = await checkRateLimit("chat:user_1", rule);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.retryAfterSeconds).toBe(0);
  });

  it("allows the request that lands exactly on the limit", async () => {
    queryRaw.mockResolvedValue(row(3, 60));

    expect((await checkRateLimit("chat:user_1", rule)).allowed).toBe(true);
  });

  it("blocks the request past the limit", async () => {
    queryRaw.mockResolvedValue(row(4, 60));

    const result = await checkRateLimit("chat:user_1", rule);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("reports how long to wait, never zero, when blocked", async () => {
    queryRaw.mockResolvedValue(row(9, 45));

    const result = await checkRateLimit("chat:user_1", rule);

    expect(result.retryAfterSeconds).toBeGreaterThan(40);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(45);
  });

  it("floors a blocked retry hint at one second rather than rounding to zero", async () => {
    // A window expiring in 20ms would floor to 0 and invite an immediate retry.
    queryRaw.mockResolvedValue(row(9, 0.02));

    expect(
      (await checkRateLimit("chat:user_1", rule)).retryAfterSeconds,
    ).toBe(1);
  });

  it("allows again once the window has rolled over and the count restarts", async () => {
    // The reset is the SQL's: an expired row is rewritten to count 1 with a fresh expiry.
    queryRaw.mockResolvedValue(row(1, 60));

    const result = await checkRateLimit("chat:user_1", rule);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("passes the key and window to the counter statement", async () => {
    queryRaw.mockResolvedValue(row(1, 60));

    await checkRateLimit("guest-issue:203.0.113.5", {
      limit: 5,
      windowMs: 24 * 60 * 60 * 1000,
    });

    // A tagged template call: [strings, ...values].
    const [, ...values] = queryRaw.mock.calls[0] as unknown[];
    expect(values).toContain("guest-issue:203.0.113.5");
    expect(values).toContain(86_400);
  });

  it("throws rather than guessing when the statement returns no row", async () => {
    queryRaw.mockResolvedValue([]);

    await expect(checkRateLimit("chat:user_1", rule)).rejects.toThrow(
      /did not return a row/,
    );
  });

  it("never fails a request because the opportunistic sweep failed", async () => {
    queryRaw.mockResolvedValue(row(1, 60));
    deleteMany.mockRejectedValue(new Error("deadlock detected"));

    await expect(checkRateLimit("chat:user_1", rule)).resolves.toMatchObject({
      allowed: true,
    });
  });
});

describe("RATE_LIMITS", () => {
  it("keeps guest issuance far tighter than ordinary AI use", () => {
    // The cap exists so clearing the cookie cannot mint identities without bound.
    expect(RATE_LIMITS.guestIssue.limit).toBeLessThan(RATE_LIMITS.aiFeature.limit);
    expect(RATE_LIMITS.guestIssue.windowMs).toBe(24 * 60 * 60 * 1000);
  });

  it("gives PDF extraction a per-hour cap of its own", () => {
    expect(RATE_LIMITS.pdfExtract.windowMs).toBe(60 * 60 * 1000);
  });
});

describe("enforceRateLimit", () => {
  it("returns null when the caller is under the limit", async () => {
    queryRaw.mockResolvedValue(row(1, 60));

    expect(await enforceRateLimit("chat:user_1", rule)).toBeNull();
  });

  it("returns the 429 to send when the caller is over", async () => {
    queryRaw.mockResolvedValue(row(4, 60));

    const response = await enforceRateLimit("chat:user_1", rule);

    expect(response?.status).toBe(429);
  });
});

describe("tooManyRequests", () => {
  it("sets Retry-After and keeps the body shape the client already reads", async () => {
    const response = tooManyRequests({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 42,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    await expect(response.json()).resolves.toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 42,
    });
  });
});

describe("clientIp", () => {
  it("takes the first entry of the forwarded chain", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178",
    });

    expect(clientIp(headers)).toBe("203.0.113.5");
  });

  it("trims surrounding whitespace", () => {
    expect(
      clientIp(new Headers({ "x-forwarded-for": "  203.0.113.5  , 10.0.0.1" })),
    ).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("returns null when the platform supplied neither", () => {
    // Callers skip IP-based limits in this case rather than sharing one bucket between everyone.
    expect(clientIp(new Headers())).toBeNull();
  });
});
