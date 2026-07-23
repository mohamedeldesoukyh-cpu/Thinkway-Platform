export const CAMPAIGN_DECISION_ENGINE_VERSION = "campaign_decision_v1" as const;

/** Decision score dimension weights (sum = 100). */
export const DECISION_SCORE_WEIGHTS = {
  forecastConfidence: 20,
  optimizationQuality: 20,
  riskLevel: 20,
  budgetEfficiency: 15,
  creatorQuality: 10,
  audienceQuality: 10,
  operationalCompleteness: 15,
} as const;

export const READINESS_RISK_THRESHOLDS = {
  notReadyMinHighRisks: 3,
  highRiskMinHighRisks: 2,
  needsReviewMinMediumRisks: 3,
  readyWithMinorMaxHighRisks: 1,
} as const;

export const KPI_PROBABILITY_MIN_READY = 65;
