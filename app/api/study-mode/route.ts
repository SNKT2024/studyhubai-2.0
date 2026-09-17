import { requireViewer } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";

/**
 * How many past chats the sidebar returns.
 *
 * A display cap rather than a page: the list renders every row it is given and has no
 * pagination controls. Bounded so the payload cannot grow with the age of the account.
 */
const CHAT_LIMIT = 50;

// List the caller's previous study chats
export async function GET() {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const chats = await prisma.studyChat.findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: "desc" },
      take: CHAT_LIMIT,
      // Only what the sidebar renders. `userId` is the caller's own and `latestResponseId` is
      // server-side bookkeeping — neither belongs in a client payload.
      select: {
        id: true,
        title: true,
        contextMode: true,
        createdAt: true,
        updatedAt: true,
      },
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
