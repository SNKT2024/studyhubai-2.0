import { requireViewer } from "@/lib/api-guard";
import { prisma } from "@/lib/prisma";
import { gradeAnswer } from "@/lib/quiz";
import type { QuizReviewItem } from "@/lib/types";
import z from "zod";

const attemptRequestSchema = z.object({
  quizId: z.string().trim().min(1),
  // questionId -> the exact option text the user picked
  answers: z.record(z.string(), z.string()),
  timeSpent: z.number().int().nonnegative().optional(),
});

export async function POST(req: Request) {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const parsedRequest = attemptRequestSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid quiz attempt" },
        { status: 400 },
      );
    }

    const { quizId, answers, timeSpent } = parsedRequest.data;

    // Only the owner's quiz can be attempted, so another user's quiz id grades as missing.
    const quiz = await prisma.quiz.findFirst({
      where: { id: quizId, userId: viewer.userId },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!quiz) {
      return Response.json({ message: "Quiz not found" }, { status: 404 });
    }

    const review: QuizReviewItem[] = quiz.questions.map((question) => {
      const chosen = answers[question.id] ?? null;
      // Shared with the mid-quiz check endpoint, so a "Correct" the user saw while answering
      // cannot turn into a wrong answer in the final score.
      const { isCorrect, correctOptionIndex } = gradeAnswer(
        question.options,
        question.correctAnswer,
        chosen,
      );

      return {
        questionId: question.id,
        question: question.question,
        options: question.options,
        chosen,
        correctAnswer: question.correctAnswer,
        correctOptionIndex,
        isCorrect,
        explanation: question.explanation,
      };
    });

    const score = review.filter((item) => item.isCorrect).length;
    const totalQuestions = review.length;
    const percentage =
      totalQuestions === 0 ? 0 : Math.round((score / totalQuestions) * 100);

    const attempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        userId: viewer.userId,
        score,
        totalQuestions,
        percentage,
        timeSpent: timeSpent ?? null,
        answers,
      },
    });

    return Response.json({ attempt: { ...attempt, review } });
  } catch (error) {
    console.error("Quiz attempt error:", error);

    return Response.json(
      { message: "Failed to save the quiz attempt" },
      { status: 500 },
    );
  }
}
