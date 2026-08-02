/**
 * Enterprise Creator Intelligence — Performance (Sprint 4)
 * Historical performance behaviour for Planning / Client / Reporting / Analytics / AI / Mobile.
 */

import type { AnalysisWindowKey } from "@/lib/enterprise-creator-intelligence/category-brand/types";

export type { AnalysisWindowKey };

export type PerformanceTrendLabel =
  | "Improving"
  | "Stable"
  | "Declining"
  | "Volatile"
  | "Recovering"
  | "Unknown";

export type PerformanceStabilityLevel =
  | "Highly Stable"
  | "Stable"
  | "Moderately Variable"
  | "Volatile"
  | "Highly Volatile";

export type PublishingEffectivenessLevel =
  | "High consistency"
  | "Medium consistency"
  | "Irregular"
  | "Dormant";

export type PerformanceReliabilityLevel =
  | "Highly Reliable"
  | "Reliable"
  | "Moderately Reliable"
  | "Unpredictable"
  | "Low Confidence";

export type PerformanceMetricKey =
  | "views"
  | "reach"
  | "engagement"
  | "engagement_rate"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "watch_time"
  | "completion_rate";

export type AudienceResponseKey =
  | "engagement_trend"
  | "view_trend"
  | "reach_trend"
  | "interaction_trend"
  | "save_trend"
  | "share_trend";

export type PerformanceSource = {
  platform: string | null;
  collectionMethod: string;
  refreshTime: string | null;
  confidence: number | null;
};

export type PerformanceConfidence = {
  percent: number | null;
  reason: string;
  basedOn: Array<{ label: string; value: string | number }>;
};

export type PerformanceExplainability = {
  value: string | number | null;
  meaning: string;
  confidence: number | null;
  evidence: string[];
  historicalTrend: string;
  businessContext: string;
  dataSource: PerformanceSource;
  lastUpdated: string | null;
  missingInputs: string[];
};

export type PerformanceMetricSnapshot = {
  key: PerformanceMetricKey;
  label: string;
  value: number | null;
  unit: "count" | "rate" | "seconds" | "percent";
  confidence: PerformanceConfidence;
  trend: PerformanceTrendLabel;
  whatChanged: string;
  why: string;
  businessImplication: string;
  explainability: PerformanceExplainability;
  source: PerformanceSource;
};

export type WindowPerformanceBundle = {
  window: AnalysisWindowKey;
  sampleCount: number;
  metrics: PerformanceMetricSnapshot[];
  missingInputs: string[];
};

export type AudienceResponseInsight = {
  key: AudienceResponseKey;
  label: string;
  trend: PerformanceTrendLabel;
  value: number | null;
  confidence: PerformanceConfidence;
  explainability: PerformanceExplainability;
  source: PerformanceSource;
};

export type PublishingEffectivenessInsight = {
  level: PublishingEffectivenessLevel;
  postingFrequencyPerWeek: number | null;
  performanceCorrelation: number | null;
  meaning: string;
  confidence: PerformanceConfidence;
  explainability: PerformanceExplainability;
};

export type CampaignPerformanceInsight = {
  campaignViews: number | null;
  campaignReach: number | null;
  campaignEngagement: number | null;
  campaignRoi: number | null;
  campaignEmv: number | null;
  campaignCompletion: number | null;
  campaignSuccess: PerformanceTrendLabel;
  campaignDelivery: number | null;
  sampleCampaignCount: number;
  confidence: PerformanceConfidence;
  explainability: PerformanceExplainability;
  source: PerformanceSource;
  missingInputs: string[];
};

export type PerformanceReliabilityInsight = {
  level: PerformanceReliabilityLevel;
  meaning: string;
  why: string;
  confidence: PerformanceConfidence;
  explainability: PerformanceExplainability;
};

export type ForecastReadiness = {
  historicalTrend: PerformanceTrendLabel;
  performanceStability: PerformanceStabilityLevel;
  /** Simple seasonal signal — not a forecast. */
  seasonality: {
    detected: boolean;
    note: string;
    peakMonth: number | null;
  };
  confidence: number | null;
  /** Prediction intentionally not implemented. */
  predictionExtension: {
    available: false;
    note: string;
  };
  explainability: PerformanceExplainability;
};

export type PerformanceStabilityInsight = {
  level: PerformanceStabilityLevel;
  coefficientOfVariation: number | null;
  meaning: string;
  confidence: PerformanceConfidence;
  explainability: PerformanceExplainability;
};

export type PerformancePlanningReadiness = {
  overallTrend: PerformanceTrendLabel;
  stability: PerformanceStabilityLevel;
  reliability: PerformanceReliabilityLevel;
  publishingEffectiveness: PublishingEffectivenessLevel;
  forecastReadiness: ForecastReadiness;
  audienceResponse: AudienceResponseInsight[];
  campaignPerformanceAvailable: boolean;
};

export type CreatorPerformanceAiHints = {
  available: boolean;
  overallTrend: PerformanceTrendLabel | null;
  stability: PerformanceStabilityLevel | null;
  reliability: PerformanceReliabilityLevel | null;
  recommendRefresh: boolean;
};

export type CreatorPerformanceIntelligence = {
  influencerId: string;
  platform: string | null;
  computedAt: string;
  windows: Record<AnalysisWindowKey, WindowPerformanceBundle>;
  overallTrend: PerformanceTrendLabel;
  trendExplanation: {
    whatChanged: string;
    why: string;
    businessImplication: string;
  };
  stability: PerformanceStabilityInsight;
  audienceResponse: AudienceResponseInsight[];
  publishingEffectiveness: PublishingEffectivenessInsight;
  campaignPerformance: CampaignPerformanceInsight;
  reliability: PerformanceReliabilityInsight;
  forecastReadiness: ForecastReadiness;
  planningReadiness: PerformancePlanningReadiness;
  source: PerformanceSource;
  aiHints: CreatorPerformanceAiHints;
  consumers: readonly string[];
};

export const PERFORMANCE_CONSUMERS = [
  "Planning Workspace",
  "Client Workspace",
  "Reporting",
  "Enterprise Analytics",
  "AI Copilot",
  "Mobile",
] as const;

export const PERFORMANCE_WINDOWS: AnalysisWindowKey[] = [
  "last_30_days",
  "last_90_days",
  "last_180_days",
  "lifetime",
];
