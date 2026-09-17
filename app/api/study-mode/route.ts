import { requireViewer } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

// List the caller's previous study chats
export async function GET() {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const chats = await prisma.studyChat.findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ chats });
  } catch (error) {
    console.error("Failed to fetch study chats:", error);
    return Response.json(
      { error: "Unable to load previous chats." },
      { status: 500 },
    );
  }
}
