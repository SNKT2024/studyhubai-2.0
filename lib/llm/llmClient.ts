import { createOpenAI } from "@ai-sdk/openai";
const AI_MODEL = process.env.AI_MODEL ?? "gpt-4o-mini";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
const BASE_URL = process.env.BASE_URL;

if (!OPENAI_API_KEY) {
  throw new Error(
    "Missing OpenAI API key. Set OPENAI_API_KEY in .env.local and restart the dev server.",
  );
}

export const openai = createOpenAI({ apiKey: OPENAI_API_KEY });
