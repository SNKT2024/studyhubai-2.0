import { generateObject } from "ai";
import { openai } from "../llm/llmClient";
import z from "zod";
const mcqQuestion = z.object({
  question_id: z.number(),
  question: z.string(),
  options: z.object({
    a: z.string(),
    b: z.string(),
    c: z.string(),
    d: z.string(),
  }),
  answer: z.string().nullable(),
});

const mcqResponse = z.object({
  questions: z.array(mcqQuestion),
});

const otherQuestions = z.object({
  question_id: z.number(),
  question: z.string(),
  answer: z.string().nullable(),
});

const otherQuestionResponse = z.object({
  questions: z.array(otherQuestions),
});
export async function generateQuestions(prompt: string, format: string) {
  try {
    const response = await generateObject({
      model: openai.responses("gpt-4o-mini"),
      prompt,
      schema: format === "MCQ" ? mcqResponse : otherQuestionResponse,
      providerOptions: {
        openai: {
          store: true,
        },
      },
    });

    return response.object;
  } catch (error) {
    console.error("Question generation error:", error);

    throw new Error("Failed to generate questions");
  }
}
