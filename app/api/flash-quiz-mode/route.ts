import { SourceType } from "@/lib/generated/prisma/enums";
import { generateFlashcarQuiz } from "@/lib/llm/flashCards_Quiz";
import { prisma } from "@/lib/prisma";
import { loadPrompt } from "@/lib/prompts/prompLoader";
import { normalizeCorrectAnswer } from "@/lib/quiz";
import z from "zod";

const flashQuizRequestSchema = z.object({
  action: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  sourceType: z.enum([SourceType.TOPIC, SourceType.PDF]).optional(),
  sourceName: z.string().trim().min(1).nullish(),
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

    const { action, topic, sourceType, sourceName } = parsedRequest.data;
    const userId = "123";
    const normalizedAction = action.toLowerCase();

    if (normalizedAction !== "flashcards" && normalizedAction !== "quiz") {
      return Response.json(
        { message: "Action must be Flashcards or Quiz" },
        { status: 400 },
      );
    }

    // A PDF has no meaningful topic, so the file name becomes the human-readable label.
    const resolvedSourceType = sourceType ?? SourceType.TOPIC;
    const resolvedSourceName = sourceType === SourceType.PDF ? (sourceName ?? null) : null;
    const label = resolvedSourceName ?? topic;

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
          title: `Flashcards: ${label}`,
          topic,
          sourceType: resolvedSourceType,
          sourceName: resolvedSourceName,
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
        title: `Quiz: ${label}`,
        topic,
        sourceType: resolvedSourceType,
        sourceName: resolvedSourceName,
        questions: {
          create: result.questions.map((question, index) => ({
            order: index,
            question: question.question,
            options: Object.values(question.options),
            // Store the option text, which is what schema.prisma documents for this column.
            // The model answers with an option key ("a".."d"), so it has to be resolved first.
            correctAnswer: normalizeCorrectAnswer(question.options, question.answer),
            explanation: question.explanation,
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

// Get all flashcard decks and quizzes
export async function GET() {
  const userId = "123";

  try {
    const [decks, quizzes] = await Promise.all([
      prisma.flashcardDeck.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { cards: { orderBy: { order: "asc" } } },
      }),
      prisma.quiz.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { questions: { orderBy: { order: "asc" } } },
      }),
    ]);

    return Response.json({ decks, quizzes });
  } catch (error) {
    console.error("Failed to load flashcard decks and quizzes:", error);

    return Response.json(
      { message: "Failed to load saved flashcards and quizzes" },
      { status: 500 },
    );
  }
}
