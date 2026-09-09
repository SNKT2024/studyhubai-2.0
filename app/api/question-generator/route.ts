import { ExperienceLevel, QuestionFormat } from "@/lib/generated/prisma/enums";
import { generateQuestions } from "@/lib/llm/llmClient";
import { prisma } from "@/lib/prisma";
import { loadPrompt } from "@/lib/prompts/prompLoader";

type QuestionRequest = {
  topic: string;
  question_format: QuestionFormat;
  experience: ExperienceLevel;
  count: number;
  includeAnswers: boolean;
};
// Create Question Set
export async function POST(req: Request) {
  try {
    const userId = "123";

    const { topic, question_format, experience, count, includeAnswers } =
      await req.json();

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
        userId,
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
  const userId = "123";

  try {
    const allQuestions = await prisma.questionSet.findMany({
      where: { userId },
    });

    return Response.json({ questions: allQuestions });
  } catch (error) {
    return Response.json({
      message: "Failed to load previours questions",
      error,
    });
  }
}
