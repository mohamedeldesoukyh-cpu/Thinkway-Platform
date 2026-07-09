export { OpenAiProvider, createOpenAiProvider } from "./openai-provider";
export type { OpenAiProviderOptions } from "./openai-provider";

export type { LlmProvider } from "../types/llm";

import type { LlmProvider } from "../types/llm";
import { createOpenAiProvider } from "./openai-provider";

let defaultLlmProvider: LlmProvider | undefined;

export function getDefaultLlmProvider(): LlmProvider {
  if (!defaultLlmProvider) {
    defaultLlmProvider = createOpenAiProvider();
  }
  return defaultLlmProvider;
}

export function resetDefaultLlmProvider(): void {
  defaultLlmProvider = undefined;
}
