import { createPromptLibrary, PromptLibrary } from "./registry";
import { DEFAULT_PROMPT_TEMPLATES } from "./templates";

export { PromptLibrary, createPromptLibrary } from "./registry";
export type { PromptTemplate, RenderedPrompt } from "./registry";
export {
  SYSTEM_BASE_PROMPT,
  PLANNER_PROMPT,
  STRATEGIST_PROMPT,
  STRATEGIST_CLARIFY_PROMPT,
  STRATEGIST_GENERATE_PROMPT,
  SCOUT_PROMPT,
  ANALYST_PROMPT,
  GENERAL_PROMPT,
  BRIEF_GENERATION_PROMPT,
  REPORT_GENERATION_PROMPT,
  DEFAULT_PROMPT_TEMPLATES,
} from "./templates";

let defaultLibrary: PromptLibrary | undefined;

export function getDefaultPromptLibrary(): PromptLibrary {
  if (!defaultLibrary) {
    defaultLibrary = createPromptLibrary();
    defaultLibrary.registerMany(DEFAULT_PROMPT_TEMPLATES);
  }
  return defaultLibrary;
}

export function resetDefaultPromptLibrary(): void {
  defaultLibrary = undefined;
}
