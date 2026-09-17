import "server-only";

import { FLASHCARD_QUIZ_PROMPT } from "./flashcard_quiz.prompt";
import { QUESTION_GENERATOR_PROMPT } from "./questiongenerator.prompt";
import { STUDY_MODE_PROMPT } from "./studymode.prompt";

/**
 * Every prompt the app ships. Prompts are imported rather than read from disk at runtime, which
 * is what makes them part of the server bundle — see `studymode.prompt.ts` for why that matters.
 */
const PROMPTS = {
  studymode: STUDY_MODE_PROMPT,
  flashcard_quiz: FLASHCARD_QUIZ_PROMPT,
  questiongenerator: QUESTION_GENERATOR_PROMPT,
} as const;

export type PromptName = keyof typeof PROMPTS;

/**
 * Returns `name` with every `{{variable}}` placeholder replaced by its value.
 *
 * Synchronous on purpose: the old loader returned a promise because it hit the filesystem, and
 * there is no longer a reason for call sites to await.
 */
export function renderPrompt(
  name: PromptName,
  variables: Record<string, unknown> = {},
): string {
  let prompt: string = PROMPTS[name];

  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, String(value));
  }

  return prompt;
}

/**
 * Any placeholder `renderPrompt` was not given a value for. Exported for the test suite, which
 * asserts every prompt's placeholders are supplied by its caller.
 */
export function unfilledPlaceholders(prompt: string): string[] {
  return [...new Set(prompt.match(/\{\{\w+\}\}/g) ?? [])];
}
