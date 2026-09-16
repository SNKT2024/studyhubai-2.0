import { generateText, Output } from "ai";
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

const model = openai.responses("gpt-4o-mini");
const providerOptions = { openai: { store: true } };

export async function generateQuestions(
  prompt: string,
  format: string,
): Promise<z.infer<typeof mcqResponse> | z.infer<typeof otherQuestionResponse>> {
  try {
    // Branched rather than picking the schema with a ternary: `Output.object` needs a single
    // concrete schema to infer its result type from, and a union of two schemas defeats that.
    if (format === "MCQ") {
      const { output } = await generateText({
        model,
        prompt,
        providerOptions,
        output: Output.object({ schema: mcqResponse }),
      });

      return output;
    }

    const { output } = await generateText({
      model,
      prompt,
      providerOptions,
      output: Output.object({ schema: otherQuestionResponse }),
    });

    return output;
  } catch (error) {
    console.error("Question generation error:", error);

    throw new Error("Failed to generate questions");
  }
}
