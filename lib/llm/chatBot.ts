import { generateText, smoothStream, streamText } from "ai";
import { openai } from "./llmClient";

export async function generateChatMessage(prompt: string) {
  try {
    const result = await generateText({
      model: openai.responses("gpt-4o-mini"),
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
    model: openai.responses("gpt-4o-mini"),
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
