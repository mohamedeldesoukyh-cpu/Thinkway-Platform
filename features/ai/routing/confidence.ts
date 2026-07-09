import type { AiRequest } from "../types";

import type {
  AgentConfidenceScore,
  ConfidenceResult,
  IntentType,
  RequestAnalysisResult,
  RoutableAgentId,
} from "./types";

const DEFAULT_MULTI_AGENT_THRESHOLD = 90;

const BASE_SCORES: Record<RoutableAgentId, number> = {
  general: 35,
  strategist: 10,
  planner: 10,
  scout: 10,
  analyst: 10,
};

const INTENT_AGENT_BOOST: Partial<
  Record<IntentType, Partial<Record<RoutableAgentId, number>>>
> = {
  general: { general: 95 },
  strategy: { strategist: 92, planner: 25 },
  planning: { planner: 92, strategist: 30 },
  discovery: { scout: 92 },
  analysis: { analyst: 92 },
  reporting: { analyst: 90 },
  creator: { scout: 55 },
  campaign: { strategist: 45, planner: 40 },
  client: { strategist: 35, general: 30 },
  shortlist: { scout: 75 },
  unknown: { general: 60 },
};

const EXPLICIT_INTENT_AGENT_BOOST: Record<
  NonNullable<AiRequest["intent"]>,
  Partial<Record<RoutableAgentId, number>>
> = {
  general: { general: 98 },
  strategize: { strategist: 98 },
  plan: { planner: 98 },
  scout: { scout: 98 },
  analyze: { analyst: 98 },
};

const WORKSPACE_AGENT_BOOST: Partial<
  Record<
    RequestAnalysisResult["contextSignals"]["workspaceType"],
    Partial<Record<RoutableAgentId, number>>
  >
> = {
  discovery: { scout: 40 },
  campaign: { planner: 35, analyst: 25 },
  client: { strategist: 25 },
  brand: { strategist: 30 },
  general: { general: 20 },
};

const SIGNAL_AGENT_BOOST: Array<{
  signalId: string;
  boosts: Partial<Record<RoutableAgentId, number>>;
}> = [
  {
    signalId: "general-conversation",
    boosts: { general: 90 },
  },
  {
    signalId: "strategy-request",
    boosts: { strategist: 88 },
  },
  {
    signalId: "operational-campaign-brief",
    boosts: { strategist: 92 },
  },
  {
    signalId: "planning-request",
    boosts: { planner: 88 },
  },
  {
    signalId: "discovery-request",
    boosts: { scout: 88 },
  },
  {
    signalId: "analysis-request",
    boosts: { analyst: 88 },
  },
  {
    signalId: "reporting-request",
    boosts: { analyst: 85 },
  },
  {
    signalId: "shortlist-request",
    boosts: { scout: 70 },
  },
  {
    signalId: "compound-request",
    boosts: { strategist: 15, scout: 15, planner: 10, analyst: 10 },
  },
  {
    signalId: "explicit-intent",
    boosts: {},
  },
  {
    signalId: "workspace-discovery",
    boosts: { scout: 35 },
  },
  {
    signalId: "workspace-campaign",
    boosts: { planner: 30, analyst: 20 },
  },
  {
    signalId: "selected-creators",
    boosts: { scout: 25, strategist: 15 },
  },
];

const EXPLICIT_INTENT_AGENT: Record<
  NonNullable<AiRequest["intent"]>,
  RoutableAgentId
> = {
  general: "general",
  strategize: "strategist",
  plan: "planner",
  scout: "scout",
  analyze: "analyst",
};

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)));
}

function applyBoost(
  scores: Map<RoutableAgentId, { score: number; reasons: string[] }>,
  agentId: RoutableAgentId,
  boost: number,
  reason: string
): void {
  if (boost <= 0) {
    return;
  }

  const entry = scores.get(agentId) ?? { score: BASE_SCORES[agentId], reasons: [] };
  entry.score += boost;
  entry.reasons.push(reason);
  scores.set(agentId, entry);
}

/**
 * Computes per-agent confidence scores from structured request analysis.
 * Uses a weighted signal matrix — not per-agent canHandle() logic.
 */
export function computeConfidence(
  analysis: RequestAnalysisResult,
  options: { threshold?: number } = {}
): ConfidenceResult {
  const threshold = options.threshold ?? DEFAULT_MULTI_AGENT_THRESHOLD;
  const agentIds = Object.keys(BASE_SCORES) as RoutableAgentId[];

  const scores = new Map<RoutableAgentId, { score: number; reasons: string[] }>();

  for (const agentId of agentIds) {
    scores.set(agentId, { score: BASE_SCORES[agentId], reasons: ["base"] });
  }

  const intentBoosts = INTENT_AGENT_BOOST[analysis.primaryIntent];
  if (intentBoosts) {
    for (const [agentId, boost] of Object.entries(intentBoosts) as Array<
      [RoutableAgentId, number]
    >) {
      applyBoost(scores, agentId, boost, `primary-intent:${analysis.primaryIntent}`);
    }
  }

  for (const secondary of analysis.secondaryIntents) {
    const secondaryBoosts = INTENT_AGENT_BOOST[secondary];
    if (secondaryBoosts) {
      for (const [agentId, boost] of Object.entries(secondaryBoosts) as Array<
        [RoutableAgentId, number]
      >) {
        applyBoost(scores, agentId, Math.round(boost * 0.85), `secondary-intent:${secondary}`);
      }
    }
  }

  if (analysis.explicitIntent) {
    const explicitBoosts = EXPLICIT_INTENT_AGENT_BOOST[analysis.explicitIntent];
    for (const [agentId, boost] of Object.entries(explicitBoosts) as Array<
      [RoutableAgentId, number]
    >) {
      applyBoost(scores, agentId, boost, `explicit-intent:${analysis.explicitIntent}`);
    }
  }

  const workspaceBoosts = WORKSPACE_AGENT_BOOST[analysis.contextSignals.workspaceType];
  if (workspaceBoosts) {
    for (const [agentId, boost] of Object.entries(workspaceBoosts) as Array<
      [RoutableAgentId, number]
    >) {
      applyBoost(
        scores,
        agentId,
        boost,
        `workspace:${analysis.contextSignals.workspaceType}`
      );
    }
  }

  for (const signal of analysis.signals) {
    if (
      analysis.explicitIntent &&
      analysis.explicitIntent !== "general" &&
      signal.id === "general-conversation"
    ) {
      continue;
    }

    const mapping = SIGNAL_AGENT_BOOST.find((entry) => entry.signalId === signal.id);
    if (!mapping) {
      continue;
    }

    for (const [agentId, boost] of Object.entries(mapping.boosts) as Array<
      [RoutableAgentId, number]
    >) {
      applyBoost(scores, agentId, boost, signal.label);
    }
  }

  if (
    analysis.normalizedMessage.length < 20 &&
    analysis.primaryIntent === "unknown" &&
    !analysis.explicitIntent
  ) {
    applyBoost(scores, "general", 50, "short-unknown-message");
  }

  if (analysis.explicitIntent) {
    applyBoost(
      scores,
      EXPLICIT_INTENT_AGENT[analysis.explicitIntent],
      100,
      `explicit-intent-override:${analysis.explicitIntent}`
    );
  }

  const agentScores: AgentConfidenceScore[] = agentIds
    .map((agentId) => {
      const entry = scores.get(agentId)!;
      return {
        agentId,
        score: clampScore(entry.score),
        reasons: entry.reasons,
      };
    })
    .sort((a, b) => b.score - a.score);

  const highestScore = agentScores[0]?.score ?? 0;
  const multiAgentCandidates = agentScores
    .filter((entry) => entry.score >= threshold)
    .map((entry) => entry.agentId);

  return {
    scores: agentScores,
    primaryIntent: analysis.primaryIntent,
    highestScore,
    threshold,
    multiAgentCandidates,
  };
}

export { DEFAULT_MULTI_AGENT_THRESHOLD, EXPLICIT_INTENT_AGENT };
