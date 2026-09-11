import { ContextMode } from "@/lib/generated/prisma/enums";
import { streamChatMessage } from "@/lib/llm/llmClient";
import { prisma } from "@/lib/prisma";

type RouteParams = {
  userId: string;
  chatId: string;
};

// chatId comes from the route, not the body
type Message = {
  content: string;
  modeUsed?: ContextMode;
  role: "user" | "assistant";
};

// Get Chat Context
export async function GET(
  request: Request,
  { params }: { params: Promise<RouteParams> },
): Promise<Response> {
  const { userId, chatId } = await params;

  // find and get chat
  const chat = await prisma.studyChat.findFirst({
    where: {
      userId,
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
  const { userId, chatId } = await params;
  const { content, role }: Message = await request.json();

  const chat = await prisma.studyChat.findFirst({
    where: { userId, id: chatId },
    select: { id: true, latestResponseId: true },
  });

  if (!chat) {
    return Response.json({ error: "Chat not found" }, { status: 404 });
  }

  await prisma.studyMessage.create({ data: { chatId, content, role } });

  const result = streamChatMessage(
    content,
    chat.latestResponseId ?? undefined,
    async (assistantContent, responseId) => {
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
  );

  return result.toTextStreamResponse();
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<RouteParams> },
) {
  try {
    const { userId, chatId } = await params;

    const chat = await prisma.studyChat.findFirst({
      where: { id: chatId, userId },
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
