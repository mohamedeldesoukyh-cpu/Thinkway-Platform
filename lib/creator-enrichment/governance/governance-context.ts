import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";
import type { CreatorEnrichmentDecisionOutcome } from "@/lib/creator-enrichment/decision/decision-result";
import type { ExecutionPlan } from "@/lib/creator-enrichment/execution/execution-plan-types";

import { recordDecisionAnalytics } from "./analytics/decision-analytics";
import {
  buildGovernanceTrace,
  logGovernanceTrace,
} from "./explainability/governance-trace";
import { calculateIntelligenceHealthScore } from "./intelligence/health-score";
import { generateRefreshRecommendations } from "./intelligence/recommendation-engine";
import { resolveEnrichmentPolicyForRequest } from "./policy/policy-engine";
import { recordRuleEvaluationHealth } from "./rules/rule-management";
import { computeSnapshotCompleteness } from "@/lib/creator-enrichment/decision/snapshot/snapshot-completeness";

/** Orchestrator hook — records governance signals for a completed decision cycle. */
export function buildGovernanceContextForRequest(input: {
  context: CreatorEnrichmentDecisionContext;
  decision: CreatorEnrichmentDecisionOutcome;
  plan?: ExecutionPlan | null;
}): void {
  if (!input.decision.snapshot) {
    return;
  }

  const appliedPolicy = resolveEnrichmentPolicyForRequest({
    context: input.context,
    snapshot: input.decision.snapshot,
  });

  recordRuleEvaluationHealth(input.decision.ruleEvaluations);

  const completeness = computeSnapshotCompleteness(input.decision.snapshot);

  recordDecisionAnalytics({
    decisionId: input.decision.decisionId,
    traceId: input.decision.traceId,
    requestId: input.context.requestId,
    decision: input.decision.decision,
    winningRule: input.decision.winningRule,
    reason: input.decision.reason,
    force: input.context.force,
    feature: input.context.feature,
    operation: input.context.operation,
    decisionTimeMs: input.decision.decisionTimeMs,
    snapshotBuildTimeMs: input.decision.snapshotBuildTimeMs,
    snapshotCompleteness: completeness.snapshotCompleteness,
    ruleEvaluations: input.decision.ruleEvaluations,
    estimatedApifySavings: input.plan?.totals.estimatedSavingsApifyCredits ?? 0,
    estimatedDurationSavingsMs: input.plan?.totals.estimatedSavingsDurationMs ?? 0,
    optimizationPercentage: input.plan?.totals.optimizationPercentage ?? 0,
  });

  const healthScore =
    input.decision.snapshot.creatorId || input.decision.snapshot.influencerId
      ? calculateIntelligenceHealthScore({
          snapshot: input.decision.snapshot,
          policy: appliedPolicy,
        })
      : null;

  const recommendations =
    input.decision.snapshot.creatorId || input.decision.snapshot.influencerId
      ? generateRefreshRecommendations({
          snapshot: input.decision.snapshot,
          policy: appliedPolicy,
        })
      : null;

  const trace = buildGovernanceTrace({
    requestId: input.context.requestId,
    decision: input.decision,
    plan: input.plan,
    appliedPolicy,
    healthScore,
    recommendations,
  });
  logGovernanceTrace(trace);
}
