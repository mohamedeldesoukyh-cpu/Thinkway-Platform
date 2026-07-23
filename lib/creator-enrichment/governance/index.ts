export {
  getGovernancePolicy,
  setGovernancePolicyForTests,
  resetGovernancePolicyForTests,
  resolveEnrichmentPolicy,
  resolveEnrichmentPolicyForRequest,
  buildPolicyResolutionContext,
  isMetricsFreshForPolicy,
  isWithinPolicyDays,
} from "./policy/policy-engine";
export {
  DEFAULT_GOVERNANCE_POLICY,
  DEFAULT_HEALTH_SCORE_WEIGHTS,
  GOVERNANCE_POLICY_VERSION,
} from "./policy/policy-defaults";
export type {
  GovernancePolicyConfig,
  ResolvedEnrichmentPolicy,
  PolicyResolutionContext,
  CreatorIntelligenceTier,
  PlatformPolicyKey,
  EnrichmentPolicySlice,
  HealthScoreWeights,
} from "./policy/policy-types";

export {
  getRuleManagementSnapshot,
  getRuleMetadata,
  setRuleEnabled,
  setRulePriorityOverride,
  getEffectiveRulePriority,
  isRuleActive,
  isRuleFeatureEnabled,
  recordRuleEvaluationHealth,
  validateRuleDependencies,
  getFeatureFlags,
  setFeatureFlag,
  resetRuleManagementForTests,
  RULE_MANAGEMENT_VERSION,
} from "./rules/rule-management";
export type {
  RuleMetadata,
  RuleManagementSnapshot,
  RuleHealthSnapshot,
  FeatureFlagState,
} from "./rules/rule-types";

export {
  recordDecisionAnalytics,
  getDecisionAnalyticsSnapshot,
  getRecentDecisionRecords,
  resetDecisionAnalyticsForTests,
} from "./analytics/decision-analytics";
export type {
  DecisionAnalyticsSnapshot,
  DecisionAnalyticsRecord,
} from "./analytics/decision-analytics";

export {
  calculateIntelligenceHealthScore,
} from "./intelligence/health-score";
export type {
  IntelligenceHealthScore,
  HealthScoreComponent,
} from "./intelligence/health-score";

export {
  generateRefreshRecommendations,
  generateRecommendationReportForSnapshot,
} from "./intelligence/recommendation-engine";
export type {
  RefreshRecommendation,
  RefreshRecommendationAction,
  CreatorRecommendationReport,
} from "./intelligence/recommendation-types";

export {
  assessCreatorIntelligenceNeeds,
  rankCreatorsByRefreshPriority,
} from "./intelligence/autonomous-intelligence";
export type { AutonomousIntelligenceAssessment } from "./intelligence/autonomous-intelligence";

export {
  buildGovernanceReport,
  validateGovernancePolicy,
  buildCreatorGovernanceContext,
  buildRecommendationReportExample,
} from "./reports/governance-reports";
export type { GovernanceReport, PolicyValidationReport } from "./reports/governance-reports";

export {
  buildGovernanceTrace,
  logGovernanceTrace,
} from "./explainability/governance-trace";
export type { GovernanceTrace } from "./explainability/governance-trace";

export { buildGovernanceContextForRequest } from "./governance-context";
