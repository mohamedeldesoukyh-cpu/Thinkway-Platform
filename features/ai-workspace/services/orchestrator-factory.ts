import { createAiOrchestrator, type AiOrchestrator, type LlmProvider } from "@/features/ai";

import { createStreamingOpenAiProvider } from "./streaming-openai-provider";

let workspaceOrchestrator: AiOrchestrator | undefined;

/**
 * Workspace-scoped orchestrator with LLM provider injection.
 * Does not modify frozen getDefaultAiOrchestrator().
 */
export function getWorkspaceAiOrchestrator(
  llmProvider?: LlmProvider
): AiOrchestrator {
  if (!workspaceOrchestrator) {
    workspaceOrchestrator = createAiOrchestrator({
      llmProvider: llmProvider ?? createStreamingOpenAiProvider(),
    });
  }
  return workspaceOrchestrator;
}

export function resetWorkspaceAiOrchestrator(): void {
  workspaceOrchestrator = undefined;
}
