export {
  evaluateCampaignDecision,
  toCampaignDecisionSnapshot,
} from "./campaign-decision-engine";
export {
  CAMPAIGN_DECISION_ENGINE_VERSION,
  DECISION_SCORE_WEIGHTS,
  KPI_PROBABILITY_MIN_READY,
} from "./config";
export { buildApprovalSummary, extractOptimizationStrengths } from "./approval-summary";
export { computeDecisionScore } from "./decision-score";
export { computeKpiProbabilities, minKpiProbability } from "./kpi-probability";
export { assessLaunchReadiness, readinessBlocksApproval } from "./readiness";
export { buildDecisionRecommendations } from "./recommendations";
export { buildRiskMatrix, detectCampaignRisks } from "./risks";
export type {
  CampaignApprovalSummary,
  CampaignConfiguration,
  CampaignDecisionInput,
  CampaignDecisionReport,
  CampaignDecisionScore,
  CampaignDecisionSnapshot,
  CampaignKpiTargets,
  CampaignRisk,
  CommercialIntelligenceSnapshot,
  DecisionRecommendation,
  DecisionRecommendationKind,
  KpiAchievementProbability,
  LaunchReadiness,
  OperationalIntelligenceSnapshot,
  RiskCategory,
  RiskSeverity,
} from "./types";
