/**
 * Enterprise Creator Intelligence SSOT policy (G1).
 *
 * Platform consumers must use `@/lib/enterprise-creator-intelligence` only.
 * Discovery / legacy scores remain Discovery-acquisition tools — never investment SSOT.
 */

export const ECI_PLATFORM_CONSUMERS = [
  "Planning Workspace",
  "Client Workspace",
  "Campaign Workspace",
  "Reporting Hub",
  "Enterprise Analytics",
  "AI Copilot",
  "Mobile",
] as const;

/**
 * Surfaces that must NOT be used as Enterprise Creator Intelligence /
 * Creator Investment SSOT for Planning · Client · Campaign · Reporting · Analytics · AI · Mobile.
 */
export const FORBIDDEN_ENTERPRISE_INTELLIGENCE_SSOT = [
  {
    id: "discovery_thinkway_score",
    path: "lib/creators/thinkway-score.ts",
    allowedFor: "Discovery acquisition / browse ranking only",
  },
  {
    id: "discovery_campaign_relevance",
    path: "lib/discovery/campaign-relevance-scoring.ts",
    allowedFor: "Discovery campaign-fit acquisition only",
  },
  {
    id: "campaign_decision_simulator_score",
    path: "features/campaign-decision-engine/decision-score.ts",
    allowedFor: "Campaign decision simulation UI only — not investment SSOT",
  },
  {
    id: "campaign_optimization_health_score",
    path: "lib/campaign-optimization/health-score.ts",
    allowedFor: "Campaign optimization health — not creator investment SSOT",
  },
] as const;

export const ECI_CANONICAL_ENTRY =
  "loadCreatorIntelligenceBundle" as const;

export function isForbiddenEnterpriseIntelligencePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  return FORBIDDEN_ENTERPRISE_INTELLIGENCE_SSOT.some((entry) =>
    normalized.includes(entry.path)
  );
}
