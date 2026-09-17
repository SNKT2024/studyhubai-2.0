import { ExperienceLevel, QuestionFormat } from "@/lib/generated/prisma/enums";
import { chargeOr402, requireViewer } from "@/lib/api-guard";
import { CREDIT_FEATURES } from "@/lib/credits";
import { generateQuestions } from "@/lib/llm/generateQuestions";
import { prisma } from "@/lib/prisma";
import { loadPrompt } from "@/lib/prompts/prompLoader";
import z from "zod";

const questionRequestSchema = z.object({
  topic: z.string().trim().min(1),
  question_format: z.enum([
    QuestionFormat.MCQ,
    QuestionFormat.SENTENCE_BASED,
    QuestionFormat.INTERVIEW_BASED,
  ]),
  experience: z.enum([
    ExperienceLevel.FRESHER_0_1,
    ExperienceLevel.EXPERIENCED_3_PLUS,
  ]),
  count: z.number().int().min(1).max(10),
  includeAnswers: z.boolean(),
});
// Create Question Set
export async function POST(req: Request) {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const parsedRequest = questionRequestSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid question generation request" },
        { status: 400 },
      );
    }

    // Charged only once the request is known to be valid, so a malformed body is not billed.
    const exhausted = await chargeOr402(viewer, CREDIT_FEATURES.questionSet);
    if (exhausted) return exhausted;

    const { topic, question_format, experience, count, includeAnswers } =
      parsedRequest.data;

    const prompt = await loadPrompt("questiongenerator", {
      topic,
      question_format,
      experience,
      count,
      includeAnswers,
    });

    const questions = await generateQuestions(prompt, question_format);

    // save to db
    await prisma.questionSet.create({
      data: {
        userId: viewer.userId,
        topic,
        format: question_format,
        experienceLevel: experience,
        count,
        questions: questions.questions,
      },
    });
    return Response.json(questions);
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        message: "Failed to generate questions",
      },
      { status: 500 },
    );
  }
}

// Get All Questions

export async function GET() {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  try {
    const allQuestions = await prisma.questionSet.findMany({
      where: { userId: viewer.userId },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ questions: allQuestions });
  } catch (error) {
    return Response.json({
      message: "Failed to load previours questions",
      error,
    });
  }
}
