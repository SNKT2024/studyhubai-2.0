import { ContextMode } from "@/lib/generated/prisma/enums";
import { generateChatMessage } from "@/lib/llm/chatBot";
import { prisma } from "@/lib/prisma";
import { loadPrompt } from "@/lib/prompts/prompLoader";
import { NextRequest } from "next/server";

type NewChatData = {
  userId: string;
  topic: string;
  contextMode: ContextMode;
};

// Create a new chat and retrun chatid
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { userId, topic, contextMode }: NewChatData = await request.json();

    // create new chat
    const chat = await prisma.studyChat.create({
      data: { userId, title: topic, contextMode },
    });

    // load system prompt
    const prompt = await loadPrompt("studymode", {
      contextMode,
      userTopic: topic,
    });

    // create inital greeting message
    const message = await generateChatMessage(prompt);

    // Save the greeting and its response ID together.
    await prisma.$transaction([
      prisma.studyMessage.create({
        data: {
          chatId: chat.id,
          content: message.content,
          role: "assistant",
          modeUsed: contextMode,
        },
      }),
      prisma.studyChat.update({
        where: { id: chat.id },
        data: { latestResponseId: message.responseId },
      }),
    ]);

    return Response.json(
      { message: "Chat created successfully", chatId: chat.id, userId },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to create study chat", error);
    return Response.json(
      { error: "Could not create study chat. Please try again." },
      { status: 500 },
    );
  }
}
