import { prisma } from "@/lib/prisma";
import { findCorrectOptionIndex } from "@/lib/quiz";
import type { QuizReviewItem } from "@/lib/types";
import z from "zod";

const attemptRequestSchema = z.object({
  quizId: z.string().trim().min(1),
  // questionId -> the exact option text the user picked
  answers: z.record(z.string(), z.string()),
  timeSpent: z.number().int().nonnegative().optional(),
});

export async function POST(req: Request) {
  try {
    const parsedRequest = attemptRequestSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid quiz attempt" },
        { status: 400 },
      );
    }

    const { quizId, answers, timeSpent } = parsedRequest.data;
    const userId = "123";

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!quiz) {
      return Response.json({ message: "Quiz not found" }, { status: 404 });
    }

    const review: QuizReviewItem[] = quiz.questions.map((question) => {
      const chosen = answers[question.id] ?? null;
      const correctOptionIndex = findCorrectOptionIndex(
        question.options,
        question.correctAnswer,
      );
      const chosenIndex =
        chosen === null ? -1 : question.options.indexOf(chosen);

      return {
        questionId: question.id,
        question: question.question,
        options: question.options,
        chosen,
        correctAnswer: question.correctAnswer,
        correctOptionIndex,
        // When correctOptionIndex is -1 the stored answer matches no option, so nothing can be
        // graded as correct rather than silently marking everyone right.
        isCorrect: chosenIndex !== -1 && chosenIndex === correctOptionIndex,
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
        userId,
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
