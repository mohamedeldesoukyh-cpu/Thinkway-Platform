import { createPromptLibrary, PromptLibrary } from "./registry";
import { DEFAULT_PROMPT_TEMPLATES } from "./templates";

export { PromptLibrary, createPromptLibrary } from "./registry";
export type { PromptTemplate, RenderedPrompt } from "./registry";
export {
  SYSTEM_BASE_PROMPT,
  PLANNER_PROMPT,
  PLANNER_DEVELOPER_PROMPT,
  STRATEGIST_PROMPT,
  STRATEGIST_DEVELOPER_PROMPT,
  STRATEGIST_CLARIFY_PROMPT,
  STRATEGIST_CLARIFY_DEVELOPER_PROMPT,
  STRATEGIST_GENERATE_PROMPT,
  STRATEGIST_GENERATE_DEVELOPER_PROMPT,
  SCOUT_PROMPT,
  SCOUT_DEVELOPER_PROMPT,
  ANALYST_PROMPT,
  ANALYST_DEVELOPER_PROMPT,
  GENERAL_PROMPT,
  GENERAL_DEVELOPER_PROMPT,
  BRIEF_GENERATION_PROMPT,
  BRIEF_GENERATION_DEVELOPER_PROMPT,
  REPORT_GENERATION_PROMPT,
  REPORT_GENERATION_DEVELOPER_PROMPT,
  DEFAULT_PROMPT_TEMPLATES,
} from "./templates";
export {
  buildPromptLayers,
  promptLayersToMessages,
  wrapUntrustedUserContent,
  systemPromptContainsUserRequestMarker,
  UNTRUSTED_PROMPT_VARIABLE_KEYS,
} from "./prompt-isolation";
export type { PromptLayers, UntrustedDocument } from "./prompt-isolation";

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
