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

/**
 * Streams an assistant reply.
 *
 * `onError` exists so the caller can undo what it committed before the stream opened — the
 * handler in `app/api/study-mode/[chatId]/route.ts` uses it to refund the credit it charged. A
 * failure after the first byte cannot be reported as an HTTP status, because the response is
 * already committed, so a callback is the only place left to react.
 *
 * `streamRetries` is left at its default of 0, so a provider error surfaces once rather than
 * firing the refund path repeatedly.
 */
export function streamChatMessage(
  prompt: string,
  previousResponseId: string | undefined,
  onFinish: (content: string, responseId: string) => Promise<void>,
  onError?: (error: unknown) => Promise<void>,
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
    onError: async ({ error }) => {
      await onError?.(error);
    },
  });
}
