/**
 * Enterprise Creator Intelligence — Audience (Sprint 5)
 * Audience demographics, growth, quality, geography, language for Planning consumers.
 */

import type { AnalysisWindowKey } from "@/lib/enterprise-creator-intelligence/category-brand/types";

export type { AnalysisWindowKey };

export type AudienceGrowthTrend =
  | "Growing"
  | "Stable"
  | "Declining"
  | "Spike"
  | "Drop"
  | "Unknown";

export type AudienceQualityLevel =
  | "High Quality"
  | "Good"
  | "Monitor"
  | "Low Confidence"
  | "Unknown";

export type AudienceStabilityLevel =
  | "Highly Stable"
  | "Stable"
  | "Seasonal"
  | "Volatile"
  | "Recovering";

export type AudienceLanguageRole = "Primary" | "Secondary" | "Emerging";

export type AudienceSource = {
  platform: string | null;
  collectionMethod: string;
  refreshTime: string | null;
  confidence: number | null;
};

export type AudienceConfidence = {
  percent: number | null;
  reason: string;
  basedOn: Array<{ label: string; value: string | number }>;
};

export type AudienceExplainability = {
  value: string | number | null;
  meaning: string;
  confidence: number | null;
  evidence: string[];
  historicalTrend: string;
  businessContext: string;
  source: AudienceSource;
  lastUpdated: string | null;
  missingInputs: string[];
};

export type DistributionSlice = {
  key: string;
  label: string;
  percent: number | null;
};

export type AudienceDemographicsBundle = {
  gender: DistributionSlice[];
  age: DistributionSlice[];
  countries: DistributionSlice[];
  cities: DistributionSlice[];
  languages: DistributionSlice[];
  demographicSource: string | null;
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
  source: AudienceSource;
  /** True when only a single demographic snapshot exists for all windows. */
  historicalSeriesAvailable: "Yes" | "No";
  missingInputs: string[];
};

export type AudienceGrowthInsight = {
  followerGrowth: number | null;
  growthPercent: number | null;
  growthTrend: AudienceGrowthTrend;
  organicGrowth: number | null;
  suddenSpikes: Array<{ at: string; growthPercent: number }>;
  suddenDrops: Array<{ at: string; growthPercent: number }>;
  whatChanged: string;
  why: string;
  businessImplication: string;
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
  source: AudienceSource;
};

export type AudienceQualityInsight = {
  level: AudienceQualityLevel;
  meaning: string;
  /** Explicitly not a fake-follower estimate. */
  fakeFollowerEstimation: {
    available: false;
    note: string;
  };
  supportedIndicators: string[];
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
};

export type AudienceStabilityInsight = {
  level: AudienceStabilityLevel;
  meaning: string;
  why: string;
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
};

export type AudienceEngagementBehaviour = {
  engagementConsistency: AudienceStabilityLevel | "Unknown";
  returningEngagement: "Supported" | "Unavailable";
  interactionTrend: string;
  shareBehaviour: string;
  saveBehaviour: string;
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
  missingInputs: string[];
};

export type AudienceGeographyInsight = {
  primaryCountries: string[];
  primaryCities: string[];
  regionalDistribution: DistributionSlice[];
  historicalChanges: string;
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
  source: AudienceSource;
};

export type AudienceLanguageInsight = {
  primary: string | null;
  secondary: string[];
  emerging: string[];
  mix: Array<{ language: string; role: AudienceLanguageRole; percent: number | null }>;
  historicalMovement: string;
  confidence: AudienceConfidence;
  explainability: AudienceExplainability;
  source: AudienceSource;
};

export type AudienceBusinessReadiness = {
  audienceFit: string;
  audienceStability: AudienceStabilityLevel;
  audienceConfidence: number | null;
  commercialAudienceReadiness:
    | "Ready"
    | "Needs Demographics"
    | "Limited Confidence"
    | "Insufficient Growth History";
  geography: AudienceGeographyInsight;
  languages: AudienceLanguageInsight;
  quality: AudienceQualityLevel;
};

export type WindowAudienceBundle = {
  window: AnalysisWindowKey;
  demographics: AudienceDemographicsBundle;
  growth: AudienceGrowthInsight;
  missingInputs: string[];
};

export type CreatorAudienceAiHints = {
  available: boolean;
  quality: AudienceQualityLevel | null;
  stability: AudienceStabilityLevel | null;
  growthTrend: AudienceGrowthTrend | null;
  primaryCountry: string | null;
  recommendRefresh: boolean;
};

export type CreatorAudienceIntelligence = {
  influencerId: string;
  platform: string | null;
  computedAt: string;
  windows: Record<AnalysisWindowKey, WindowAudienceBundle>;
  quality: AudienceQualityInsight;
  stability: AudienceStabilityInsight;
  engagementBehaviour: AudienceEngagementBehaviour;
  geography: AudienceGeographyInsight;
  languages: AudienceLanguageInsight;
  businessReadiness: AudienceBusinessReadiness;
  source: AudienceSource;
  aiHints: CreatorAudienceAiHints;
  consumers: readonly string[];
};

export const AUDIENCE_CONSUMERS = [
  "Planning Workspace",
  "Client Workspace",
  "Reporting",
  "Enterprise Analytics",
  "AI Copilot",
  "Mobile",
] as const;

export const AUDIENCE_WINDOWS: AnalysisWindowKey[] = [
  "last_30_days",
  "last_90_days",
  "last_180_days",
  "lifetime",
];
