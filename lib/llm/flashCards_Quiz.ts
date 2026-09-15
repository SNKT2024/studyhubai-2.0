import { generateObject } from "ai";
import { openai } from "./llmClient";
import z from "zod";

const flashcardResponse = z.object({
  flashcards: z.array(
    z.object({
      front: z.string(),
      back: z.string(),
      hint: z.string(),
    }),
  ),
});

const quizResponse = z.object({
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
    }),
  ),
});

export type FlashQuizMode = "flashcards" | "quiz";

export async function generateFlashcarQuiz(
  prompt: string,
  mode: FlashQuizMode,
) {
  try {
    const response = await generateObject({
      model: openai.responses("gpt-4o-mini"),
      prompt,
      providerOptions: {
        openai: {
          store: true,
        },
      },
      schema: mode === "flashcards" ? flashcardResponse : quizResponse,
    });

    return response.object;
  } catch (error) {
    console.error("Question generation error:", error);

    throw new Error("Failed to generate questions");
  }
}
