import type { AiContext, AiRequest } from "../types";

/** Canonical intent categories for the Intent Intelligence Engine. */
export type IntentType =
  | "general"
  | "strategy"
  | "planning"
  | "discovery"
  | "analysis"
  | "reporting"
  | "creator"
  | "campaign"
  | "client"
  | "shortlist"
  | "finance"
  | "legal"
  | "unknown";

export type RoutableAgentId =
  | "general"
  | "strategist"
  | "planner"
  | "scout"
  | "analyst";

export interface MessageSignal {
  id: string;
  weight: number;
  label: string;
}

export interface ContextSignals {
  hasCampaign: boolean;
  hasClient: boolean;
  hasShortlist: boolean;
  hasSelectedCreators: boolean;
  hasFilters: boolean;
  workspaceType: AiContext["workspace"]["type"];
  conversationTurns: number;
  urlContextPresent: boolean;
}

export interface RequestAnalysisResult {
  request: AiRequest;
  context: AiContext;
  normalizedMessage: string;
  primaryIntent: IntentType;
  secondaryIntents: IntentType[];
  signals: MessageSignal[];
  contextSignals: ContextSignals;
  isCompoundRequest: boolean;
  explicitIntent: AiRequest["intent"];
}

export interface AgentConfidenceScore {
  agentId: RoutableAgentId;
  score: number;
  reasons: string[];
}

export interface ConfidenceResult {
  scores: AgentConfidenceScore[];
  primaryIntent: IntentType;
  highestScore: number;
  threshold: number;
  multiAgentCandidates: RoutableAgentId[];
}

export interface RoutingDecision {
  primaryAgentId: RoutableAgentId;
  selectedAgentIds: RoutableAgentId[];
  confidence: ConfidenceResult;
  analysis: RequestAnalysisResult;
  reason: string;
  multiAgent: boolean;
}

export interface AgentRouterOptions {
  /** Minimum confidence for multi-agent selection (default 90). */
  multiAgentThreshold?: number;
  /** Agent IDs registered for routing (general always included). */
  agentIds?: RoutableAgentId[];
}

export interface AgentExecutionPlan {
  decision: RoutingDecision;
  agentIds: RoutableAgentId[];
}
