import type { CampaignForecast } from "@/lib/campaign-forecast";

import type { CAMPAIGN_OPTIMIZATION_ENGINE_VERSION } from "./config";

export type OptimizationImpactLevel = "high" | "medium" | "low";

export type OptimizationCategory =
  | "reach"
  | "budget"
  | "creator_mix"
  | "platform"
  | "deliverable"
  | "audience";

export type CampaignOptimizationContext = {
  budget?: { amount: number; currency?: string | null };
  tierMix?: Array<{ tier: string; percent: number }>;
  creatorTiers?: Record<string, string>;
  audienceTargets?: {
    countryCodes?: string[];
    languageCodes?: string[];
    categories?: string[];
  };
  campaignPlatform?: string | null;
};

export type CampaignOptimizationInput = {
  forecast: CampaignForecast;
  context?: CampaignOptimizationContext;
};

export type HealthScoreDeduction = {
  factor: string;
  points: number;
  reason: string;
};

export type HealthScoreDimension = {
  key: keyof typeof import("./config").HEALTH_SCORE_WEIGHTS;
  label: string;
  score: number;
  weight: number;
  weightedContribution: number;
  deductions: HealthScoreDeduction[];
};

export type CampaignHealthScore = {
  overall: number;
  label: "excellent" | "good" | "fair" | "needs_work";
  dimensions: HealthScoreDimension[];
  explainability: string[];
};

export type OptimizationOpportunity = {
  id: string;
  category: OptimizationCategory;
  impact: OptimizationImpactLevel;
  title: string;
  summary: string;
  expectedReachGainPct: number | null;
  expectedViewGainPct: number | null;
  expectedEngagementGainPct: number | null;
  expectedBudgetSavingsPct: number | null;
  triggeredMetrics: string[];
  confidence: number;
};

export type OptimizationRecommendation = {
  id: string;
  opportunityId: string;
  category: OptimizationCategory;
  impact: OptimizationImpactLevel;
  action: string;
  expectedImpact: string;
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  reasoning: string[];
  triggeredMetrics: string[];
  kpiDelta?: {
    estimatedReach?: number | null;
    estimatedViews?: number | null;
    estimatedEngagements?: number | null;
  };
};

export type OptimizationScenarioKind =
  | "current"
  | "reach_optimized"
  | "engagement_optimized"
  | "budget_optimized"
  | "balanced";

export type ScenarioKpiSnapshot = {
  estimatedReach: number;
  estimatedViews: number;
  estimatedEngagements: number;
  averageEngagementRate: number | null;
  overlapDeduction: number;
};

export type ScenarioComparison = {
  scenario: OptimizationScenarioKind;
  label: string;
  kpis: ScenarioKpiSnapshot;
  deltaFromCurrent: {
    estimatedReachPct: number;
    estimatedViewsPct: number;
    estimatedEngagementsPct: number;
  };
  assumptions: string[];
};

export type CampaignOptimizationDiagnostics = {
  creatorCount: number;
  categoriesAnalyzed: OptimizationCategory[];
  forecastConfidence: number;
  limitedAudienceSignals: boolean;
  overlapRatio: number | null;
  reachEfficiency: number | null;
};

/** Normalized optimization report — SSOT for all modules. */
export type CampaignOptimizationReport = Readonly<{
  engineVersion: typeof CAMPAIGN_OPTIMIZATION_ENGINE_VERSION;
  healthScore: CampaignHealthScore;
  /** Headroom score — lower means more optimization potential. */
  optimizationScore: number;
  opportunities: OptimizationOpportunity[];
  recommendations: OptimizationRecommendation[];
  scenarioComparisons: ScenarioComparison[];
  diagnostics: CampaignOptimizationDiagnostics;
  explainability: string[];
  computedAt: string;
}>;

/** Serializable snapshot for Studio persistence and exports. */
export type CampaignOptimizationSnapshot = CampaignOptimizationReport;

export type AnalyzerFinding = {
  category: OptimizationCategory;
  impact: OptimizationImpactLevel;
  title: string;
  summary: string;
  triggeredMetrics: string[];
  expectedReachGainPct?: number | null;
  expectedViewGainPct?: number | null;
  expectedEngagementGainPct?: number | null;
  expectedBudgetSavingsPct?: number | null;
  confidence?: number;
  recommendationAction?: string;
  recommendationReasoning?: string[];
  kpiDelta?: OptimizationRecommendation["kpiDelta"];
  metadata?: Record<string, string | number | null>;
};
