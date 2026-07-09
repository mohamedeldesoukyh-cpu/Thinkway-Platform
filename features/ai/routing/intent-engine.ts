import { computeConfidence, EXPLICIT_INTENT_AGENT } from "./confidence";
import { analyzeRequest } from "./request-analysis";
import type { AiContext, AiRequest } from "../types";
import type {
  AgentRouterOptions,
  ConfidenceResult,
  RequestAnalysisResult,
  RoutingDecision,
  RoutableAgentId,
} from "./types";
import { DEFAULT_MULTI_AGENT_THRESHOLD } from "./confidence";

export interface IntentAnalysisResult {
  analysis: RequestAnalysisResult;
  confidence: ConfidenceResult;
  decision: RoutingDecision;
}

const AGENT_EXECUTION_ORDER: RoutableAgentId[] = [
  "strategist",
  "planner",
  "scout",
  "analyst",
  "general",
];

function sortAgentsForExecution(agentIds: RoutableAgentId[]): RoutableAgentId[] {
  return [...agentIds].sort(
    (a, b) => AGENT_EXECUTION_ORDER.indexOf(a) - AGENT_EXECUTION_ORDER.indexOf(b)
  );
}

function selectAgents(
  confidence: ConfidenceResult,
  analysis: RequestAnalysisResult,
  threshold: number
): RoutableAgentId[] {
  if (analysis.explicitIntent) {
    return [EXPLICIT_INTENT_AGENT[analysis.explicitIntent]];
  }

  const sorted = confidence.scores;
  const primary = sorted[0]?.agentId ?? "general";

  if (analysis.isCompoundRequest && confidence.multiAgentCandidates.length > 1) {
    const compoundAgents = sortAgentsForExecution(confidence.multiAgentCandidates);
    return compoundAgents;
  }

  const aboveThreshold = sorted.filter((entry) => entry.score >= threshold);

  if (aboveThreshold.length > 1 && analysis.isCompoundRequest) {
    return sortAgentsForExecution(aboveThreshold.map((entry) => entry.agentId));
  }

  if (aboveThreshold.length > 1) {
    const nonGeneral = aboveThreshold.filter((entry) => entry.agentId !== "general");
    if (nonGeneral.length > 1) {
      return sortAgentsForExecution(nonGeneral.map((entry) => entry.agentId));
    }
  }

  if (primary === "general" || sorted[0]?.score < 50) {
    return ["general"];
  }

  return [primary];
}

function buildDecisionReason(
  selectedAgentIds: RoutableAgentId[],
  confidence: ConfidenceResult
): string {
  const top = confidence.scores
    .slice(0, 3)
    .map((entry) => `${entry.agentId}=${entry.score}`)
    .join(", ");

  if (selectedAgentIds.length > 1) {
    return `Multi-agent routing [${selectedAgentIds.join(" → ")}]; scores: ${top}`;
  }

  return `Single-agent routing [${selectedAgentIds[0]}]; scores: ${top}`;
}

/**
 * Central Intent Intelligence Engine.
 * Analyzes requests and produces routing decisions with confidence scores.
 */
export class IntentEngine {
  private readonly multiAgentThreshold: number;

  constructor(options: AgentRouterOptions = {}) {
    this.multiAgentThreshold =
      options.multiAgentThreshold ?? DEFAULT_MULTI_AGENT_THRESHOLD;
  }

  analyze(request: AiRequest, context: AiContext): IntentAnalysisResult {
    const analysis = analyzeRequest(request, context);
    const confidence = computeConfidence(analysis, {
      threshold: this.multiAgentThreshold,
    });

    const selectedAgentIds = selectAgents(
      confidence,
      analysis,
      this.multiAgentThreshold
    );

    const decision: RoutingDecision = {
      primaryAgentId: selectedAgentIds[0] ?? "general",
      selectedAgentIds,
      confidence,
      analysis,
      reason: buildDecisionReason(selectedAgentIds, confidence),
      multiAgent: selectedAgentIds.length > 1,
    };

    return { analysis, confidence, decision };
  }
}

export function createIntentEngine(options?: AgentRouterOptions): IntentEngine {
  return new IntentEngine(options);
}

export { analyzeRequest } from "./request-analysis";
export { computeConfidence } from "./confidence";
