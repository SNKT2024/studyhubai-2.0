import { getViewer } from "@/lib/auth";

/** The header badge reads this to show the remaining balance. */
export async function GET() {
  const viewer = await getViewer();

  if (!viewer) {
    // `kind: "none"` rather than "guest": this visitor has no identity at all — no cookie, or
    // the per-IP guest identity cap — so showing them a zero balance would be misleading.
    return Response.json(
      { credits: 0, kind: "none", code: "NO_IDENTITY" },
      { status: 401 },
    );
  }

  return Response.json({ credits: viewer.credits, kind: viewer.kind });
}
