import { generateText, smoothStream, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;

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
