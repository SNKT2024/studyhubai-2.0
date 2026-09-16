import { generateText, Output } from "ai";
import { openai } from "./llmClient";
import z from "zod";

export const flashcardResponse = z.object({
  flashcards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
      hint: z.string(),
    }),
  ),
});

export const quizResponse = z.object({
  questions: z.array(
    z.object({
      question_id: z.number(),
      question: z.string(),
      options: z.object({
        a: z.string(),
        b: z.string(),
        c: z.string(),
        d: z.string(),
      }),
      answer: z.string(),
      explanation: z.string(),
    }),
  ),
});

export type FlashcardResponse = z.infer<typeof flashcardResponse>;
export type QuizResponse = z.infer<typeof quizResponse>;

export type FlashQuizMode = "flashcards" | "quiz";

const model = openai.responses("gpt-4o-mini");
const providerOptions = { openai: { store: true } };

export async function generateFlashcarQuiz(
  prompt: string,
  mode: FlashQuizMode,
): Promise<FlashcardResponse | QuizResponse> {
  try {
    // Branched rather than picking the schema with a ternary: `Output.object` needs a single
    // concrete schema to infer its result type from, and a union of two schemas defeats that.
    if (mode === "flashcards") {
      const { output } = await generateText({
        model,
        prompt,
        providerOptions,
        output: Output.object({ schema: flashcardResponse }),
      });

      return output;
    }

    const { output } = await generateText({
      model,
      prompt,
      providerOptions,
      output: Output.object({ schema: quizResponse }),
    });

    return output;
  } catch (error) {
    console.error("Flashcard or quiz generation error:", error);

    throw new Error("Failed to generate flashcards or quiz");
  }
}
