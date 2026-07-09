import type { AiOrchestrator } from "@/features/ai";
import type { ContextBuilderInput } from "@/features/ai/shared";

import type { TaskRunnerInput, TaskRunnerOutput } from "../types";
import { workflowTrace } from "@/lib/creators/search-trace";

/**
 * Execute a single workflow task via the existing AiOrchestrator.
 * Does NOT modify orchestrator internals — calls handle() from outside.
 */
export async function runWorkflowTask(
  orchestrator: AiOrchestrator,
  input: TaskRunnerInput,
  contextInput?: Omit<ContextBuilderInput, "request">
): Promise<TaskRunnerOutput> {
  const requestId = `wf_task_${input.taskId}_${Date.now()}`;

  workflowTrace("5_taskRunner_input", input.workflowData ?? {}, "taskRunnerInput", {
    taskId: input.taskId,
    agent: input.agent,
    searchResultsLen: Array.isArray(input.workflowData?.searchResults)
      ? input.workflowData.searchResults.length
      : null,
  });

  try {
    const result = await orchestrator.handle(
      {
        id: requestId,
        message: input.message,
        intent: input.intent,
        conversationId: input.conversationId,
        context: input.context,
        metadata: {
          workflowTask: input.taskId,
          workflowAgent: input.agent,
          ...(input.userMessage?.trim()
            ? { originalUserMessage: input.userMessage.trim() }
            : {}),
          ...(input.workflowData?.searchResults != null
            ? { workflowCreators: input.workflowData.searchResults }
            : {}),
          ...(input.workflowData?.searchTotal != null
            ? { workflowSearchTotal: input.workflowData.searchTotal }
            : {}),
          ...(input.workflowData?.searchExecuted === true
            ? { searchExecuted: true }
            : {}),
        },
      },
      {
        ...contextInput,
        campaignIntelligenceProfileId:
          contextInput?.campaignIntelligenceProfileId ??
          input.context?.campaignIntelligenceProfileId ??
          (typeof input.workflowData?.campaignIntelligenceProfileId === "string"
            ? input.workflowData.campaignIntelligenceProfileId
            : undefined),
      }
    );

    if (!result.success) {
      return {
        success: false,
        content: "",
        agentId: input.agent,
        error: result.error.message,
      };
    }

    const response = result.response;
    const structured = response.structured as Record<string, unknown> | undefined;

    workflowTrace("5_taskRunner_output", { structured, content: response.content }, "taskRunnerOutput", {
      taskId: input.taskId,
      success: result.success,
      agentId: response.metadata.agentId,
    });

    if (structured?.mode === "clarification") {
      return {
        success: false,
        content: response.content,
        structured,
        agentId: response.metadata.agentId,
        toolsUsed: response.metadata.toolsUsed,
        error: "Agent requested clarification — missing information.",
      };
    }

    return {
      success: true,
      content: response.content,
      structured,
      agentId: response.metadata.agentId,
      toolsUsed: response.metadata.toolsUsed,
    };
  } catch (error) {
    return {
      success: false,
      content: "",
      agentId: input.agent,
      error: error instanceof Error ? error.message : "Task execution failed",
    };
  }
}
