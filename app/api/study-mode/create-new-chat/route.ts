import { ContextMode } from "@/lib/generated/prisma/enums";
import { requireViewer, chargeOr402 } from "@/lib/api-guard";
import { CREDIT_FEATURES } from "@/lib/credits";
import { generateChatMessage } from "@/lib/llm/chatBot";
import { prisma } from "@/lib/prisma";
import { loadPrompt } from "@/lib/prompts/prompLoader";
import { NextRequest } from "next/server";
import z from "zod";

const newChatSchema = z.object({
  topic: z.string().trim().min(1),
  contextMode: z.enum([
    ContextMode.NORMAL,
    ContextMode.EXAM_REVISION,
    ContextMode.INTERVIEW_BASED,
  ]),
});

// Create a new chat and return its id
export async function POST(request: NextRequest): Promise<Response> {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const parsedRequest = newChatSchema.safeParse(await request.json());

    if (!parsedRequest.success) {
      return Response.json(
        { error: "Enter a topic and choose a context mode." },
        { status: 400 },
      );
    }

    const { topic, contextMode } = parsedRequest.data;

    // Charged before the greeting is generated, so a caller who is out of credits never gets
    // an orphan chat sitting there with no opening message.
    const exhausted = await chargeOr402(viewer, CREDIT_FEATURES.studyChat);
    if (exhausted) return exhausted;

    const chat = await prisma.studyChat.create({
      data: { userId: viewer.userId, title: topic, contextMode },
    });

    const prompt = await loadPrompt("studymode", { contextMode, userTopic: topic });
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
      { message: "Chat created successfully", chatId: chat.id },
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
