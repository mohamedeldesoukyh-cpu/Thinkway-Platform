/**
 * Unified Campaign Forecast Engine — immutable forecast result types.
 * Single source of truth for roster-based campaign forecasting metrics.
 */

import type { ForecastStrategy } from "./forecast-strategy";

export type { ForecastStrategy };

export const CAMPAIGN_FORECAST_ENGINE_VERSION = "forecast_engine_v3";

export type ForecastConfidence = "low" | "medium" | "high";

export type ConfidenceDeduction = {
  factor: string;
  points: number;
  reason: string;
};

export type ForecastConfidenceScore = {
  /** 0–100 numeric score for sorting and thresholds. */
  score: number;
  label: ForecastConfidence;
  deductions: ConfidenceDeduction[];
  bonuses: ConfidenceDeduction[];
};

export type ForecastAssumptions = {
  reachMultiplier?: number | null;
  contentType?: string | null;
  platform?: string | null;
  deliverables?: number;
  engagementRate?: number | null;
  forecastStrategy?: ForecastStrategy;
  calculationMethod: typeof CAMPAIGN_FORECAST_ENGINE_VERSION;
  /** Additional context keys for explainability. */
  [key: string]: string | number | boolean | null | undefined;
};

export type RecentPublicationMetricInput = {
  contentType?: string | null;
  platform?: string | null;
  views?: number | null;
  reach?: number | null;
  engagements?: number | null;
  postedAt?: string | null;
};

export type CreatorHistoricalPerformanceInput = {
  avgReachByContentType?: Record<string, number>;
  avgViewsByContentType?: Record<string, number>;
  avgReach?: number | null;
  avgViews?: number | null;
  avgEngagementRate?: number | null;
  sampleSize?: number;
  dataFreshnessDays?: number | null;
  source?: string | null;
};

export type DeliverableForecast = {
  contentType: string;
  platform: string;
  quantity: number;
  estimatedReach: number;
  estimatedImpressions: number;
  estimatedViews: number;
  estimatedEngagements: number;
  reachMultiplier: number | null;
  forecastStrategy: ForecastStrategy;
  assumptions: ForecastAssumptions;
};

export type CreatorForecast = {
  creatorKey: string;
  displayName?: string | null;
  handle?: string | null;
  platform: string | null;
  platforms: string[];
  followers: number;
  /** Unique followers counted once toward audience size. */
  audienceSize: number;
  grossReach: number;
  crossPlatformOverlapDeduction: number;
  estimatedReach: number;
  estimatedImpressions: number;
  estimatedViews: number;
  estimatedEngagements: number;
  engagementRate: number | null;
  primaryForecastStrategy: ForecastStrategy;
  deliverableForecasts: DeliverableForecast[];
  assumptions: ForecastAssumptions;
  confidence: ForecastConfidenceScore;
  /** Step-by-step explainability for this creator. */
  explanation: string[];
};

export type CampaignOverlapSummary = {
  grossReach: number;
  overlapDeduction: number;
  netReach: number;
  pairCount: number;
};

export type CampaignCalculationSummary = {
  uniqueCreators: number;
  totalDeliverables: number;
  platforms: string[];
  aggregationMethod: "deduplicated_creators_with_overlap";
  overlap: CampaignOverlapSummary;
  /** Human-readable campaign-level explanation bullets. */
  bullets: string[];
};

export type CampaignForecast = Readonly<{
  audienceSize: number;
  /** Sum of creator reach before campaign-level audience overlap. */
  grossReach: number;
  /** Campaign-level audience overlap deduction. */
  overlapDeduction: number;
  estimatedReach: number;
  estimatedImpressions: number;
  estimatedViews: number;
  estimatedEngagements: number;
  /** Average engagement rate across creators with ER data (%). */
  averageEngagementRate: number | null;
  creatorForecasts: readonly CreatorForecast[];
  calculationSummary: CampaignCalculationSummary;
  assumptions: ForecastAssumptions;
  confidenceScore: ForecastConfidenceScore;
  /** Campaign-level explainability bullets. */
  explanation: readonly string[];
}>;

export type CampaignForecastDeliverableInput = {
  contentType?: string | null;
  publicationType?: string | null;
  platform?: string | null;
  quantity?: number;
};

export type CampaignForecastCreatorInput = {
  creatorKey: string;
  displayName?: string | null;
  handle?: string | null;
  followers?: number | null;
  platform?: string | null;
  primaryPlatform?: string | null;
  platforms?: string[];
  engagementRate?: number | null;
  deliverables?: CampaignForecastDeliverableInput[];
  /** Intelligence signals for overlap estimation. */
  countryCode?: string | null;
  countryCodes?: string[];
  languageCodes?: string[];
  categories?: string[];
  niche?: string | null;
  audienceInterests?: string[];
  isVerified?: boolean;
  dataFreshnessDays?: number | null;
  dnaCompleteness?: number | null;
  /** Inline historical metrics (no async DB fetch in engine). */
  historicalPerformance?: CreatorHistoricalPerformanceInput | null;
  avgReach?: number | null;
  avgViews?: number | null;
  recentPublicationMetrics?: RecentPublicationMetricInput[];
};

export type CampaignForecastOverlapConfig = {
  defaultPairOverlapRate?: number;
  maxPairOverlapRate?: number;
  crossPlatformOverlapRate?: number;
  defaultCampaignOverlapPerCreator?: number;
};

export type CampaignForecastInput = {
  creators: CampaignForecastCreatorInput[];
  /** Selected campaign platform — overrides creator platform when set. */
  campaignPlatform?: string | null;
  overlapConfig?: CampaignForecastOverlapConfig;
};

/** Serializable snapshot stored on Campaign Studio performance section. */
export type CampaignForecastSnapshot = {
  engineVersion: typeof CAMPAIGN_FORECAST_ENGINE_VERSION;
  audienceSize: number;
  grossReach: number;
  overlapDeduction: number;
  estimatedReach: number;
  estimatedImpressions: number;
  estimatedViews: number;
  estimatedEngagements: number;
  averageEngagementRate: number | null;
  confidenceScore: number;
  confidenceLabel: ForecastConfidence;
  explanation: string[];
  computedAt: string;
};
