import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";

import type { CAMPAIGN_DECISION_ENGINE_VERSION } from "./config";

export type LaunchReadiness =
  | "ready"
  | "ready_with_minor_risks"
  | "needs_review"
  | "high_risk"
  | "not_ready";

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export type RiskCategory =
  | "reach"
  | "budget"
  | "creator"
  | "audience"
  | "operational";

export type CampaignRisk = {
  id: string;
  category: RiskCategory;
  severity: RiskSeverity;
  title: string;
  businessImpact: string;
  mitigation: string;
  triggeredMetrics: string[];
  evidence: string[];
};

export type KpiAchievementProbability = {
  metric: string;
  target: number | null;
  forecastValue: number | null;
  probability: number;
  confidenceLabel: "low" | "medium" | "high";
  reasoning: string[];
};

export type DecisionScoreDeduction = {
  factor: string;
  points: number;
  reason: string;
};

export type DecisionScoreDimension = {
  key: keyof typeof import("./config").DECISION_SCORE_WEIGHTS;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  deductions: DecisionScoreDeduction[];
};

export type CampaignDecisionScore = {
  overall: number;
  label: "excellent" | "good" | "fair" | "poor";
  dimensions: DecisionScoreDimension[];
  explainability: string[];
};

export type DecisionRecommendationKind =
  | "safe_to_launch"
  | "delay_launch"
  | "replace_creators"
  | "increase_budget"
  | "reduce_overlap"
  | "expand_audience"
  | "improve_platform_mix"
  | "resolve_operational_gaps";

export type DecisionRecommendation = {
  id: string;
  kind: DecisionRecommendationKind;
  priority: "critical" | "high" | "medium" | "low";
  action: string;
  expectedBusinessImpact: string;
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  supportingEvidence: string[];
  linkedRiskIds: string[];
  linkedOptimizationIds: string[];
};

export type CampaignApprovalSummary = {
  overallAssessment: LaunchReadiness;
  headline: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
  decisionScore: number;
  readinessLabel: string;
  kpiHighlights: Array<{ metric: string; probability: number }>;
};

export type CampaignKpiTargets = {
  reach?: number | null;
  engagement?: number | null;
  engagementRate?: number | null;
  impressions?: number | null;
  views?: number | null;
  awareness?: number | null;
};

export type CommercialIntelligenceSnapshot = {
  budget?: { amount: number; currency?: string | null };
  budgetAllocated?: boolean;
  quotationLinked?: boolean;
  gpHealth?: "healthy" | "at_risk" | "critical" | null;
};

export type OperationalIntelligenceSnapshot = {
  planReadinessStatus?: "not_ready" | "ready_for_review" | null;
  planMandatoryMissing?: string[];
  operationalReadinessStatus?: "operational_ready" | "needs_attention" | null;
  operationalMandatoryMissing?: string[];
  creatorSlateComplete?: boolean;
  deliverablesDefined?: boolean;
  timelineDefined?: boolean;
  unenrichedCreatorCount?: number;
};

/** Campaign configuration — commercial + operational + targets (consumer-supplied). */
export type CampaignConfiguration = {
  campaignName?: string | null;
  objective?: string | null;
  platforms?: string[];
  kpiTargets?: CampaignKpiTargets;
  commercial?: CommercialIntelligenceSnapshot;
  operational?: OperationalIntelligenceSnapshot;
};

export type CampaignDecisionInput = {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  configuration?: CampaignConfiguration;
};

export type CampaignDecisionDiagnostics = {
  forecastEngineVersion: string;
  optimizationEngineVersion: string;
  creatorCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
  operationalGaps: number;
};

/** Normalized campaign decision report — SSOT for launch approval intelligence. */
export type CampaignDecisionReport = Readonly<{
  engineVersion: typeof CAMPAIGN_DECISION_ENGINE_VERSION;
  readiness: LaunchReadiness;
  readinessLabel: string;
  decisionScore: CampaignDecisionScore;
  risks: CampaignRisk[];
  riskMatrix: Array<{
    category: RiskCategory;
    severity: RiskSeverity;
    count: number;
    topRisk: string | null;
  }>;
  kpiProbabilities: KpiAchievementProbability[];
  recommendations: DecisionRecommendation[];
  approvalSummary: CampaignApprovalSummary;
  diagnostics: CampaignDecisionDiagnostics;
  explainability: string[];
  computedAt: string;
}>;

export type CampaignDecisionSnapshot = CampaignDecisionReport;
