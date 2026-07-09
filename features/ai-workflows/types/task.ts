import type { RoutableAgentId } from "@/features/ai/routing/types";

/** Maps agent IDs to default intents for task execution. */
export const AGENT_INTENT_MAP: Record<RoutableAgentId, import("@/features/ai").AiIntent> = {
  general: "general",
  strategist: "strategize",
  planner: "plan",
  scout: "scout",
  analyst: "analyze",
};

/** Tool categories for workflow task definitions. */
export const READ_ONLY_TOOLS = [
  "searchCreators",
  "getCampaign",
  "getClient",
  "getShortlist",
  "getCreator",
  "generateBrief",
  "generateReport",
] as const;

export const MUTATING_TOOLS = [
  "buildCampaign",
  "createShortlist",
] as const;

export type ReadOnlyTool = (typeof READ_ONLY_TOOLS)[number];
export type MutatingTool = (typeof MUTATING_TOOLS)[number];

export interface TaskRunnerInput {
  taskId: string;
  agent: RoutableAgentId;
  intent: import("@/features/ai").AiIntent;
  /** Task instruction prompt (workflow buildPrompt output). */
  message: string;
  /** Original user request — passed separately for creator search parsing. */
  userMessage?: string;
  conversationId?: string;
  context: import("@/features/ai").AiContext;
  /** Accumulated workflow state passed to agents for grounded steps. */
  workflowData?: Record<string, unknown>;
}

export interface TaskRunnerOutput {
  success: boolean;
  content: string;
  structured?: Record<string, unknown>;
  agentId: string;
  toolsUsed?: string[];
  error?: string;
}
