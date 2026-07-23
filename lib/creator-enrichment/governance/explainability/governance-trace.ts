import { logDecisionEvent } from "@/lib/creator-enrichment/decision/decision-logging";
import type { CreatorEnrichmentDecisionOutcome } from "@/lib/creator-enrichment/decision/decision-result";
import type { ExecutionPlan } from "@/lib/creator-enrichment/execution/execution-plan-types";

import type { CreatorRecommendationReport } from "../intelligence/recommendation-types";
import type { IntelligenceHealthScore } from "../intelligence/health-score";
import type { ResolvedEnrichmentPolicy } from "../policy/policy-engine";
import { getRuleManagementSnapshot } from "../rules/rule-management";

export type GovernanceTrace = Readonly<{
  traceId: string;
  decisionId: string;
  requestId: string;
  policyVersion: string;
  appliedPolicyIds: readonly string[];
  ruleManagementVersion: string;
  activeRules: readonly string[];
  disabledRules: readonly string[];
  ruleVersions: Readonly<Record<string, string>>;
  healthScore: IntelligenceHealthScore | null;
  recommendations: CreatorRecommendationReport | null;
  optimizationOpportunities: readonly string[];
  executionPlanId: string | null;
  enforcementEnabled: boolean | null;
}>;

export function buildGovernanceTrace(input: {
  requestId: string;
  decision: CreatorEnrichmentDecisionOutcome;
  plan?: ExecutionPlan | null;
  appliedPolicy: ResolvedEnrichmentPolicy;
  healthScore: IntelligenceHealthScore | null;
  recommendations: CreatorRecommendationReport | null;
}): GovernanceTrace {
  const ruleManagement = getRuleManagementSnapshot();
  const activeRules = Object.values(ruleManagement.rules)
    .filter((rule) => rule.enabled)
    .map((rule) => rule.id);
  const disabledRules = Object.values(ruleManagement.rules)
    .filter((rule) => !rule.enabled)
    .map((rule) => rule.id);
  const ruleVersions = Object.freeze(
    Object.fromEntries(
      Object.values(ruleManagement.rules).map((rule) => [rule.id, rule.version])
    )
  );

  return Object.freeze({
    traceId: input.decision.traceId,
    decisionId: input.decision.decisionId,
    requestId: input.requestId,
    policyVersion: input.appliedPolicy.policyVersion,
    appliedPolicyIds: input.appliedPolicy.appliedPolicyIds,
    ruleManagementVersion: ruleManagement.version,
    activeRules: Object.freeze(activeRules),
    disabledRules: Object.freeze(disabledRules),
    ruleVersions,
    healthScore: input.healthScore,
    recommendations: input.recommendations,
    optimizationOpportunities: Object.freeze(
      input.recommendations?.optimizationOpportunities ?? []
    ),
    executionPlanId: input.plan?.planId ?? null,
    enforcementEnabled: input.plan?.enforcementEnabled ?? null,
  });
}

export function logGovernanceTrace(trace: GovernanceTrace): void {
  logDecisionEvent("governance_trace", trace as unknown as Record<string, unknown>);
}
