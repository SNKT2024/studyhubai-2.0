import { timingSafeEqual } from "node:crypto";

import { cleanupStaleGuests } from "@/lib/guest-cleanup";

/** Idle guests older than this are removed, along with everything cascading off their row. */
const RETENTION_DAYS = 30;

/** Compares two secrets without leaking their contents through timing. */
function isAuthorised(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(header ?? "");

  if (expected.length !== provided.length) return false;

  return timingSafeEqual(expected, provided);
}

/**
 * Sweeps abandoned guest accounts. Called by a scheduler (see `vercel.json`), so it is guarded
 * by `CRON_SECRET` rather than a viewer — there is no user in this request to identify.
 *
 * An unset secret refuses the request outright: a cleanup endpoint that anyone can trigger is a
 * way to delete other people's data on demand.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    console.error(
      "CRON_SECRET is not set, so /api/cron/cleanup is disabled. Set it to enable the sweep.",
    );

    return Response.json(
      { message: "Guest cleanup is not configured." },
      { status: 503 },
    );
  }

  if (!isAuthorised(request.headers.get("authorization"), secret)) {
    return Response.json({ message: "Unauthorised." }, { status: 401 });
  }

  try {
    const deleted = await cleanupStaleGuests(RETENTION_DAYS);

    return Response.json({ deleted, retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error("Guest cleanup failed:", error);

    return Response.json({ message: "Guest cleanup failed." }, { status: 500 });
  }
}
