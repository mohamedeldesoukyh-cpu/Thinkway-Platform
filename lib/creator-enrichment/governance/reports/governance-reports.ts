import type { CreatorIntelligenceSnapshot } from "@/lib/creator-enrichment/decision/snapshot/snapshot-types";
import type { ExecutionPlan } from "@/lib/creator-enrichment/execution/execution-plan-types";
import { getExecutionOperationalMetricsSnapshot } from "@/lib/creator-enrichment/execution/operational-metrics";
import type { CreatorEnrichmentDecisionOutcome } from "@/lib/creator-enrichment/decision/decision-result";
import { computeSnapshotCompleteness } from "@/lib/creator-enrichment/decision/snapshot/snapshot-completeness";

import { getDecisionAnalyticsSnapshot } from "../analytics/decision-analytics";
import { calculateIntelligenceHealthScore } from "../intelligence/health-score";
import { generateRefreshRecommendations } from "../intelligence/recommendation-engine";
import type { CreatorRecommendationReport } from "../intelligence/recommendation-types";
import {
  getGovernancePolicy,
  resolveEnrichmentPolicyForRequest,
  type ResolvedEnrichmentPolicy,
} from "../policy/policy-engine";
import {
  getRuleManagementSnapshot,
  validateRuleDependencies,
} from "../rules/rule-management";
import { PIPELINE_ENFORCEMENT_ENABLED } from "@/lib/creator-enrichment/execution/execution-planner";

export type GovernanceReport = Readonly<{
  generatedAt: string;
  policyVersion: string;
  ruleManagementVersion: string;
  decisionAnalytics: ReturnType<typeof getDecisionAnalyticsSnapshot>;
  executionMetrics: ReturnType<typeof getExecutionOperationalMetricsSnapshot>;
  ruleManagement: ReturnType<typeof getRuleManagementSnapshot>;
  ruleDependencyIssues: ReturnType<typeof validateRuleDependencies>;
  pipelineEnforcementEnabled: boolean;
  platformReadiness: Readonly<{
    decisionPlatformReady: boolean;
    executionPlannerReady: boolean;
    pipelineEnforcementReady: boolean;
    autonomousRecommendationsReady: boolean;
    analyticsReady: boolean;
  }>;
}>;

export type PolicyValidationReport = Readonly<{
  valid: boolean;
  policyVersion: string;
  issues: readonly string[];
}>;

export function validateGovernancePolicy(): PolicyValidationReport {
  const policy = getGovernancePolicy();
  const issues: string[] = [];

  if (policy.freshnessWindowDays <= 0) {
    issues.push("freshnessWindowDays must be positive");
  }
  if (policy.dnaCompletenessThreshold < 0 || policy.dnaCompletenessThreshold > 100) {
    issues.push("dnaCompletenessThreshold must be 0–100");
  }
  const weightSum = Object.values(policy.healthScoreWeights).reduce(
    (sum, weight) => sum + weight,
    0
  );
  if (Math.abs(weightSum - 1) > 0.01) {
    issues.push(`healthScoreWeights must sum to 1.0 (current ${weightSum.toFixed(2)})`);
  }

  return Object.freeze({
    valid: issues.length === 0,
    policyVersion: policy.version,
    issues: Object.freeze(issues),
  });
}

export function buildGovernanceReport(): GovernanceReport {
  const policy = getGovernancePolicy();
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    policyVersion: policy.version,
    ruleManagementVersion: getRuleManagementSnapshot().version,
    decisionAnalytics: getDecisionAnalyticsSnapshot(),
    executionMetrics: getExecutionOperationalMetricsSnapshot(),
    ruleManagement: getRuleManagementSnapshot(),
    ruleDependencyIssues: validateRuleDependencies(),
    pipelineEnforcementEnabled: PIPELINE_ENFORCEMENT_ENABLED,
    platformReadiness: Object.freeze({
      decisionPlatformReady: true,
      executionPlannerReady: true,
      pipelineEnforcementReady: PIPELINE_ENFORCEMENT_ENABLED,
      autonomousRecommendationsReady: true,
      analyticsReady: getDecisionAnalyticsSnapshot().totalRecords >= 0,
    }),
  });
}

export function buildCreatorGovernanceContext(input: {
  decision: CreatorEnrichmentDecisionOutcome;
  plan?: ExecutionPlan | null;
}): Readonly<{
  appliedPolicy: ResolvedEnrichmentPolicy;
  healthScore: ReturnType<typeof calculateIntelligenceHealthScore>;
  recommendations: CreatorRecommendationReport | null;
  snapshotCompleteness: number;
}> {
  const appliedPolicy = resolveEnrichmentPolicyForRequest({
    context: {
      requestId: input.decision.traceId,
      feature: "manual_refresh",
      trigger: "manual",
      priority: 4,
      creatorId: input.decision.snapshot.creatorId,
      platformAccountId: input.decision.snapshot.platformAccountId,
      force: false,
      scope: "all",
      requestedBy: null,
      timestamp: input.decision.decisionTime,
      operation: "refresh",
      delegatedTo: input.decision.delegate,
      supabase: null,
    },
    snapshot: input.decision.snapshot,
  });

  const healthScore = calculateIntelligenceHealthScore({
    snapshot: input.decision.snapshot,
    policy: appliedPolicy,
  });

  const recommendations =
    input.decision.snapshot.creatorId || input.decision.snapshot.influencerId
      ? generateRefreshRecommendations({
          snapshot: input.decision.snapshot,
          policy: appliedPolicy,
        })
      : null;

  return Object.freeze({
    appliedPolicy,
    healthScore,
    recommendations,
    snapshotCompleteness: computeSnapshotCompleteness(input.decision.snapshot)
      .snapshotCompleteness,
  });
}

export function buildRecommendationReportExample(
  snapshot: CreatorIntelligenceSnapshot
): CreatorRecommendationReport {
  return generateRefreshRecommendations({ snapshot });
}
