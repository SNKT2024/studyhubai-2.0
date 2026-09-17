import { SourceType } from "@/lib/generated/prisma/enums";
import {
  chargeOr402,
  enforceAiRateLimit,
  refundOnFailure,
  requireViewer,
} from "@/lib/api-guard";
import { CREDIT_FEATURES } from "@/lib/credits";
import { generateFlashcarQuiz } from "@/lib/llm/flashCards_Quiz";
import { prisma } from "@/lib/prisma";
import { renderPrompt } from "@/lib/prompts";
import { PUBLIC_QUESTION_SELECT, normalizeCorrectAnswer } from "@/lib/quiz";
import z from "zod";

const flashQuizRequestSchema = z.object({
  action: z.string().trim().min(1),
  topic: z.string().trim().min(1),
  sourceType: z.enum([SourceType.TOPIC, SourceType.PDF]).optional(),
  sourceName: z.string().trim().min(1).nullish(),
});

/**
 * How many decks and quizzes the library returns.
 *
 * The sidebar renders every row it is given and has no pagination, so this is a display cap
 * rather than a page. Bounded so the response cannot grow with the age of the account — the
 * nested cards and questions are what made this expensive.
 */
const LIBRARY_LIMIT = 50;

const CARD_SELECT = {
  id: true,
  order: true,
  front: true,
  back: true,
  hint: true,
  isMastered: true,
} as const;

const DECK_SELECT = {
  id: true,
  title: true,
  topic: true,
  sourceType: true,
  sourceName: true,
  createdAt: true,
  updatedAt: true,
  cards: { select: CARD_SELECT, orderBy: { order: "asc" } },
} as const;

/**
 * A quiz without its answers. Uses the shared projection so the generate response and the
 * library listing cannot drift apart on which fields are safe to send.
 */
const QUIZ_SELECT = {
  id: true,
  deckId: true,
  title: true,
  topic: true,
  sourceType: true,
  sourceName: true,
  createdAt: true,
  updatedAt: true,
  questions: { select: PUBLIC_QUESTION_SELECT, orderBy: { order: "asc" } },
} as const;

// Create Flashcards or Quiz
export async function POST(req: Request) {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  // Whether a credit was actually taken, so the failure path never refunds a request that was
  // rejected before it was billed.
  let charged = false;

  try {
    const parsedRequest = flashQuizRequestSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid flashcard or quiz request" },
        { status: 400 },
      );
    }

    const { action, topic, sourceType, sourceName } = parsedRequest.data;
    const normalizedAction = action.toLowerCase();

    if (normalizedAction !== "flashcards" && normalizedAction !== "quiz") {
      return Response.json(
        { message: "Action must be Flashcards or Quiz" },
        { status: 400 },
      );
    }

    // Throttled before charging, so a caller over the burst limit is never billed.
    const throttled = await enforceAiRateLimit(viewer, "flash-quiz");
    if (throttled) return throttled;

    // Charged only once the request is known to be valid, so a malformed body is not billed.
    const exhausted = await chargeOr402(viewer, CREDIT_FEATURES.flashQuiz);
    if (exhausted) return exhausted;
    charged = true;

    // A PDF has no meaningful topic, so the file name becomes the human-readable label.
    const resolvedSourceType = sourceType ?? SourceType.TOPIC;
    const resolvedSourceName = sourceType === SourceType.PDF ? (sourceName ?? null) : null;
    const label = resolvedSourceName ?? topic;

    const prompt = renderPrompt("flashcard_quiz", {
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
          userId: viewer.userId,
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
        select: DECK_SELECT,
      });

      // Only the persisted deck, not `...result`: the raw model output is not a shape the
      // client uses, and forwarding it means forwarding whatever the model chose to include.
      return Response.json({ deck });
    }

    if (!("questions" in result)) {
      throw new Error("Quiz generation returned an invalid response");
    }

    const quiz = await prisma.quiz.create({
      data: {
        userId: viewer.userId,
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
      select: QUIZ_SELECT,
    });

    return Response.json({ quiz });
  } catch (error) {
    console.error("Flashcard or quiz generation error:", error);

    // The charge happens before the model call, so reaching here with `charged` set means the
    // caller paid for a generation that never arrived.
    if (charged) {
      await refundOnFailure(viewer, CREDIT_FEATURES.flashQuiz, "generation-failed");
    }

    return Response.json(
      { message: "Failed to generate flashcards or quiz" },
      { status: 500 },
    );
  }
}

// Get all flashcard decks and quizzes
export async function GET() {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const [decks, quizzes] = await Promise.all([
      prisma.flashcardDeck.findMany({
        where: { userId: viewer.userId },
        orderBy: { createdAt: "desc" },
        take: LIBRARY_LIMIT,
        select: DECK_SELECT,
      }),
      prisma.quiz.findMany({
        where: { userId: viewer.userId },
        orderBy: { createdAt: "desc" },
        take: LIBRARY_LIMIT,
        select: QUIZ_SELECT,
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
