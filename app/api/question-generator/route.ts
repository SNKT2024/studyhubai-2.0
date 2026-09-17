import { ExperienceLevel, QuestionFormat } from "@/lib/generated/prisma/enums";
import {
  chargeOr402,
  enforceAiRateLimit,
  refundOnFailure,
  requireViewer,
} from "@/lib/api-guard";
import { CREDIT_FEATURES } from "@/lib/credits";
import { generateQuestions } from "@/lib/llm/generateQuestions";
import { prisma } from "@/lib/prisma";
import { renderPrompt } from "@/lib/prompts";
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

/**
 * How many past sets the history endpoint returns.
 *
 * A display cap rather than a page: the sidebar renders every row it is given and has no
 * pagination controls. Bounded so the response cannot grow with the account's lifetime.
 */
const QUESTION_SET_LIMIT = 20;

// Create Question Set
export async function POST(req: Request) {
  const viewer = await requireViewer();
  if (viewer instanceof Response) return viewer;

  // Whether a credit was actually taken. A request rejected before the charge — malformed JSON,
  // a failed schema, a throttle — must not refund a credit it never spent.
  let charged = false;

  try {
    const parsedRequest = questionRequestSchema.safeParse(await req.json());

    if (!parsedRequest.success) {
      return Response.json(
        { message: "Invalid question generation request" },
        { status: 400 },
      );
    }

    // Throttled before charging, so a caller over the burst limit is never billed.
    const throttled = await enforceAiRateLimit(viewer, "question-set");
    if (throttled) return throttled;

    // Charged only once the request is known to be valid, so a malformed body is not billed.
    const exhausted = await chargeOr402(viewer, CREDIT_FEATURES.questionSet);
    if (exhausted) return exhausted;
    charged = true;

    const { topic, question_format, experience, count, includeAnswers } =
      parsedRequest.data;

    const prompt = renderPrompt("questiongenerator", {
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
    console.error("Question generation error:", error);

    // The charge happens before the model call, so reaching here with `charged` set means the
    // caller paid for a generation that never arrived.
    if (charged) {
      await refundOnFailure(
        viewer,
        CREDIT_FEATURES.questionSet,
        "generation-failed",
      );
    }

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
      take: QUESTION_SET_LIMIT,
      select: {
        id: true,
        topic: true,
        format: true,
        experienceLevel: true,
        count: true,
        // Kept: QuestionViewer renders a set straight from the list, and there is no detail
        // endpoint to fetch it from. Bounding the row count is what keeps this honest.
        questions: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ questions: allQuestions });
  } catch (error) {
    console.error("Failed to load previous questions:", error);

    // The error itself stays server-side — it can carry table names and query fragments — and
    // this previously returned it under a 200, so a failure looked like a success.
    return Response.json(
      { message: "Failed to load previous questions" },
      { status: 500 },
    );
  }
}
