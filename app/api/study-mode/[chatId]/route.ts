import { chargeOr402, enforceAiRateLimit, refundOnFailure, requireViewer } from "@/lib/api-guard";
import { CREDIT_FEATURES } from "@/lib/credits";
import { streamChatMessage } from "@/lib/llm/chatBot";
import { prisma } from "@/lib/prisma";
import z from "zod";

type RouteParams = {
  chatId: string;
};

/**
 * Upper bound on a single message.
 *
 * Roughly 2,000 words: well past any legitimate study question, and low enough that a request
 * cannot smuggle a large body into Postgres and the model prompt.
 */
const MAX_MESSAGE_LENGTH = 8_000;

const messageSchema = z.object({
  // chatId comes from the route, not the body.
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

// Get Chat Context
export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  const { chatId } = await params;

  // Scoped by the session's id, so another user's chat is indistinguishable from a missing one.
  const chat = await prisma.studyChat.findFirst({
    where: {
      userId: viewer.userId,
      id: chatId,
    },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  return Response.json({ chat });
}

// Post User Response
export async function POST(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  const { chatId } = await params;

  try {
    const parsedRequest = messageSchema.safeParse(await request.json());

    if (!parsedRequest.success) {
      return Response.json(
        {
          error: `Enter a message of up to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
        },
        { status: 400 },
      );
    }

    const { content } = parsedRequest.data;

    const chat = await prisma.studyChat.findFirst({
      where: { userId: viewer.userId, id: chatId },
      select: { id: true, latestResponseId: true },
    });

    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    // Throttled before charging, so a caller over the burst limit is never billed.
    const throttled = await enforceAiRateLimit(viewer, "chat");
    if (throttled) return throttled;

    // Charged before the stream opens, not in `onFinish`: by the time `onFinish` runs the
    // response is already committed, so a 402 would be impossible to send.
    const exhausted = await chargeOr402(viewer, CREDIT_FEATURES.studyMessage);
    if (exhausted) return exhausted;

    // The role is fixed rather than taken from the body — a client has no business writing an
    // assistant turn.
    await prisma.studyMessage.create({
      data: { chatId, content, role: "user" },
    });

    // A stream that fails after the first byte cannot report a status, so the credit is
    // refunded from the error callback instead. `settled` keeps the two callbacks from both
    // acting on the same request.
    let settled = false;

    const result = streamChatMessage(
      content,
      chat.latestResponseId ?? undefined,
      async (assistantContent, responseId) => {
        settled = true;

        await prisma.$transaction([
          prisma.studyMessage.create({
            data: { chatId, content: assistantContent, role: "assistant" },
          }),
          prisma.studyChat.update({
            where: { id: chatId },
            data: { latestResponseId: responseId },
          }),
        ]);
      },
      async (error) => {
        if (settled) return;
        settled = true;

        console.error("Study chat stream failed:", error);

        // The user's message is deliberately left in place: it is a real turn they can retry.
        await refundOnFailure(viewer, CREDIT_FEATURES.studyMessage, "stream-failed");
      },
    );

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Study chat error:", error);

    return Response.json(
      { error: "Could not send that message. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
) {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const { chatId } = await params;

    const chat = await prisma.studyChat.findFirst({
      where: { id: chatId, userId: viewer.userId },
      select: { id: true },
    });

    if (!chat) {
      return Response.json({ error: "Chat not found" }, { status: 404 });
    }

    await prisma.studyChat.delete({ where: { id: chat.id } });

    return Response.json({ message: "Chat deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    return Response.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
