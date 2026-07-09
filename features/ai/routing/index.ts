export { AgentRouter, createAgentRouter } from "./agent-router";
export type { AgentRouterExecuteInput, AgentRouterExecuteResult } from "./agent-router";

export {
  IntentEngine,
  createIntentEngine,
  analyzeRequest,
  computeConfidence,
} from "./intent-engine";
export type { IntentAnalysisResult } from "./intent-engine";

export { analyzeRequest as analyzeAiRequest } from "./request-analysis";
export { computeConfidence as computeAgentConfidence } from "./confidence";
export { DEFAULT_MULTI_AGENT_THRESHOLD } from "./confidence";

export type {
  IntentType,
  RoutableAgentId,
  MessageSignal,
  ContextSignals,
  RequestAnalysisResult,
  AgentConfidenceScore,
  ConfidenceResult,
  RoutingDecision,
  AgentRouterOptions,
  AgentExecutionPlan,
} from "./types";
