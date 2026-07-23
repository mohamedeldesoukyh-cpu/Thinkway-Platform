export {
  optimizeCampaign,
  toCampaignOptimizationSnapshot,
} from "./campaign-optimization-engine";
export {
  CAMPAIGN_OPTIMIZATION_ENGINE_VERSION,
  HEALTH_SCORE_WEIGHTS,
  tierFromFollowers,
} from "./config";
export { computeCampaignHealthScore, computeOptimizationScore } from "./health-score";
export { runAllAnalyzers } from "./analyzers";
export { findingsToOpportunities } from "./opportunities";
export { buildRecommendations } from "./recommendations";
export { buildScenarioComparisons } from "./scenarios";
export type {
  CampaignHealthScore,
  CampaignOptimizationContext,
  CampaignOptimizationInput,
  CampaignOptimizationReport,
  CampaignOptimizationSnapshot,
  HealthScoreDimension,
  OptimizationCategory,
  OptimizationImpactLevel,
  OptimizationOpportunity,
  OptimizationRecommendation,
  OptimizationScenarioKind,
  ScenarioComparison,
} from "./types";
