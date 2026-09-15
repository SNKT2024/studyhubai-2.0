import { generateFlashcarQuiz } from "@/lib/llm/flashCards_Quiz";
import { prisma } from "@/lib/prisma";
import { loadPrompt } from "@/lib/prompts/prompLoader";
import z from "zod";

const flashQuizRequestSchema = z.object({
  action: z.string().trim().min(1),
  topic: z.string().trim().min(1),
});

// Create Flashcards or Quiz
export async function POST(req: Request) {
  try {
    const parsedRequest = flashQuizRequestSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid flashcard or quiz request" },
        { status: 400 },
      );
    }

    const { action, topic } = parsedRequest.data;
    const userId = "123";
    const normalizedAction = action.toLowerCase();

    if (normalizedAction !== "flashcards" && normalizedAction !== "quiz") {
      return Response.json(
        { message: "Action must be Flashcards or Quiz" },
        { status: 400 },
      );
    }

    const prompt = await loadPrompt("flashcard_quiz", {
      input: topic,
      choice: normalizedAction === "flashcards" ? "Flashcards" : "Quiz",
    });

    const result = await generateFlashcarQuiz(prompt, normalizedAction);

    if (normalizedAction === "flashcards") {
      if (!("flashcards" in result)) {
        throw new Error("Flashcard generation returned an invalid response");
      }

      const deck = await prisma.flashcardDeck.create({
        data: {
          userId,
          title: `Flashcards: ${topic}`,
          topic,
          cards: {
            create: result.flashcards.map((card, index) => ({
              order: index,
              front: card.front,
              back: card.back,
              hint: card.hint,
            })),
          },
        },
        include: { cards: true },
      });

      return Response.json({ ...result, deck });
    }

    if (!("questions" in result)) {
      throw new Error("Quiz generation returned an invalid response");
    }

    const quiz = await prisma.quiz.create({
      data: {
        userId,
        title: `Quiz: ${topic}`,
        topic,
        questions: {
          create: result.questions.map((question, index) => ({
            order: index,
            question: question.question,
            options: Object.values(question.options),
            correctAnswer: question.answer,
          })),
        },
      },
      include: { questions: true },
    });

    return Response.json({ ...result, quiz });
  } catch (error) {
    console.error("Flashcard or quiz generation error:", error);

    return Response.json(
      { message: "Failed to generate flashcards or quiz" },
      { status: 500 },
    );
  }
}
