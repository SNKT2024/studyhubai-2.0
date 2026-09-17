import { requireViewer } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { gradeAnswer } from "@/lib/quiz";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import z from "zod";

const checkSchema = z.object({
  quizId: z.string().trim().min(1),
  questionId: z.string().trim().min(1),
  /** The exact option text the user picked. */
  chosen: z.string(),
});

/**
 * Grades a single answer, mid-quiz.
 *
 * Answers are not sent to the client with the quiz — see `PUBLIC_QUESTION_SELECT` in lib/quiz.ts
 * — so this is how the runner can still tell a user whether they were right the moment they
 * answer, without the answers being readable from the network response beforehand.
 *
 * No credit is charged: this reads one row and does no model work.
 */
export async function POST(req: Request): Promise<Response> {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const parsedRequest = checkSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json({ message: "Invalid answer check" }, { status: 400 });
    }

    const { quizId, questionId, chosen } = parsedRequest.data;

    // The endpoint that can read answers is the one worth throttling, even though a caller can
    // only reach their own quizzes.
    const throttled = await enforceRateLimit(
      `quiz-check:${viewer.userId}`,
      RATE_LIMITS.quizCheck,
    );
    if (throttled) return throttled;

    // Reached through the quiz, so a question id belonging to someone else's quiz reads as
    // missing rather than being gradeable.
    const question = await prisma.quizQuestion.findFirst({
      where: { id: questionId, quizId, quiz: { userId: viewer.userId } },
      select: { options: true, correctAnswer: true, explanation: true },
    });

    if (!question) {
      return Response.json({ message: "Question not found" }, { status: 404 });
    }

    const graded = gradeAnswer(question.options, question.correctAnswer, chosen);

    return Response.json({
      ...graded,
      // Only ever one question's answer, and only after the user has committed to a choice.
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
    });
  } catch (error) {
    console.error("Quiz answer check error:", error);

    return Response.json(
      { message: "Failed to check that answer" },
      { status: 500 },
    );
  }
}
