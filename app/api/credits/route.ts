import { getViewer } from "@/lib/auth";

/** The header badge reads this to show the remaining balance. */
export async function GET() {
  const viewer = await getViewer();

  if (!viewer) {
    return Response.json({ credits: 0, kind: "guest" }, { status: 401 });
  }

  return Response.json({ credits: viewer.credits, kind: viewer.kind });
}
