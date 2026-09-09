import { readFile } from "fs/promises";
import path from "path";

type PromptVariables = Record<string, unknown>;

export async function loadPrompt(
  promptPath: string,
  variables: PromptVariables = {},
): Promise<string> {
  const fullPath = path.join(process.cwd(), "prompts", `${promptPath}.txt`);

  let prompt = await readFile(fullPath, "utf-8");

  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replaceAll(`{{${key}}}`, String(value));
  }

  return prompt;
}
