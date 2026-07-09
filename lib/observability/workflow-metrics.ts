import { logDuration, logError, logInfo } from "@/lib/observability/structured-logger";
import { mergeRequestContext } from "@/lib/observability/request-context";

export type WorkflowMetricsInput = {
  route: string;
  startedAt: number;
  status: "success" | "error" | "stream_error";
  userId?: string;
  conversationId?: string;
  campaignId?: string;
  workflowId?: string;
  agentId?: string;
  handled?: boolean;
  latencyMs?: number;
  model?: string;
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };
  costUsd?: number;
  error?: string;
};

/** Log AI chat/workflow boundary metrics without touching orchestrator logic. */
export function recordWorkflowMetrics(input: WorkflowMetricsInput): void {
  mergeRequestContext({
    service: "ai-chat",
    workflow: input.workflowId,
    conversationId: input.conversationId,
    campaignId: input.campaignId,
    userId: input.userId,
  });

  const fields = {
    service: "ai-chat",
    workflow: input.workflowId,
    requestId: undefined,
    conversationId: input.conversationId,
    campaignId: input.campaignId,
    userId: input.userId,
    status: input.status,
    route: input.route,
    agentId: input.agentId,
    handled: input.handled,
    model: input.model,
    latencyMs: input.latencyMs,
    tokens: input.tokens,
    costUsd: input.costUsd,
    error: input.error,
  };

  if (input.status === "error" || input.status === "stream_error") {
    logError("workflow-metrics", `${input.route} ${input.status}`, fields);
    return;
  }

  logDuration("workflow-metrics", `${input.route} completed`, input.startedAt, fields);
}

/** Extract token/cost metadata when already present on workflow response metadata. */
export function extractTokenMetrics(metadata: Record<string, unknown> | undefined): {
  tokens?: WorkflowMetricsInput["tokens"];
  costUsd?: number;
  model?: string;
  latencyMs?: number;
} {
  if (!metadata) return {};

  const usage = metadata.usage as
    | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    | undefined;

  return {
    tokens: usage
      ? {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens,
        }
      : undefined,
    costUsd:
      typeof metadata.costUsd === "number"
        ? metadata.costUsd
        : typeof metadata.estimatedCostUsd === "number"
          ? metadata.estimatedCostUsd
          : undefined,
    model: typeof metadata.model === "string" ? metadata.model : undefined,
    latencyMs:
      typeof metadata.latencyMs === "number" ? metadata.latencyMs : undefined,
  };
}

export function logWorkflowBoundaryStart(input: {
  route: string;
  userId: string;
  conversationId?: string;
  campaignId?: string;
}): void {
  logInfo("workflow-metrics", `${input.route} started`, {
    service: "ai-chat",
    route: input.route,
    userId: input.userId,
    conversationId: input.conversationId,
    campaignId: input.campaignId,
  });
}
