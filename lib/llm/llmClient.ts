import { generateObject, generateText, smoothStream, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import z from "zod";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
const BASE_URL = process.env.BASE_URL;

if (!OPENAI_API_KEY) {
  throw new Error(
    "Missing OpenAI API key. Set OPENAI_API_KEY in .env.local and restart the dev server.",
  );
}

const openai = createOpenAI({ apiKey: OPENAI_API_KEY });

export async function generateChatMessage(prompt: string) {
  try {
    const result = await generateText({
      model: openai.responses(AI_MODEL),
      prompt,
      providerOptions: {
        openai: { store: true },
      },
    });

    return { content: result.text, responseId: result.response.id };
  } catch (error) {
    console.error(error);
    throw new Error("Failed to generate message");
  }
}

export function streamChatMessage(
  prompt: string,
  previousResponseId: string | undefined,
  onFinish: (content: string, responseId: string) => Promise<void>,
) {
  return streamText({
    model: openai.responses(AI_MODEL),
    prompt,
    providerOptions: {
      openai: {
        store: true,
        previousResponseId,
      },
    },
    experimental_transform: smoothStream({ delayInMs: 20, chunking: "word" }),
    onFinish: async ({ text, response }) => {
      await onFinish(text, response.id);
    },
  });
}

// MCQ response
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
      model: openai.responses(AI_MODEL),
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
