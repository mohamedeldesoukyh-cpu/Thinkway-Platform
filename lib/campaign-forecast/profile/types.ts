/**
 * Unified Creator Forecast Profile — normalized forecasting data layer (Phase 3).
 * The Campaign Forecast Engine consumes ONLY hydrated inputs derived from this model.
 */

export const FORECAST_PROFILE_VERSION = "forecast_profile_v1" as const;
export const FORECAST_BASELINE_VERSION = "baseline_v1" as const;
export const FORECAST_HISTORICAL_DATA_VERSION = "historical_v1" as const;

export type ForecastReadiness =
  | "ready"
  | "benchmark_only"
  | "limited_historical"
  | "missing_performance";

export type ForecastTrend = "up" | "down" | "stable" | "unknown";

export type ForecastDataSource =
  | "campaign_publications"
  | "enrichment_publications"
  | "profile_posts"
  | "profile_metrics"
  | "influencer_metrics_history"
  | "creator_dna"
  | "stored_baseline"
  | "computed_baseline"
  | "platform_benchmark"
  | "manual";

export type CreatorForecastIdentity = {
  creatorKey: string;
  unifiedId: string | null;
  influencerId: string | null;
  discoveredProfileId: string | null;
  displayName: string | null;
  handle: string | null;
};

export type CreatorForecastAudience = {
  countryCode: string | null;
  countryCodes: string[];
  languageCodes: string[];
  categories: string[];
  niche: string | null;
  audienceInterests: string[];
};

export type CreatorForecastEngagement = {
  engagementRate: number | null;
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
};

export type NormalizedHistoricalMetricPoint = {
  capturedAt: string;
  value: number;
};

export type NormalizedHistoricalPerformance = {
  followerSeries: NormalizedHistoricalMetricPoint[];
  engagementRateSeries: NormalizedHistoricalMetricPoint[];
  avgViewsSeries: NormalizedHistoricalMetricPoint[];
  postingFrequencySeries: NormalizedHistoricalMetricPoint[];
  followerGrowthTrend: ForecastTrend;
  engagementTrend: ForecastTrend;
  dataFreshnessDays: number | null;
  primarySource: ForecastDataSource;
};

export type NormalizedPublicationMetric = {
  platform: string;
  contentType: string;
  views: number | null;
  reach: number | null;
  impressions: number | null;
  engagements: number | null;
  engagementRate: number | null;
  postedAt: string | null;
  source: ForecastDataSource;
};

export type CreatorPerformanceBaseline = {
  platform: string;
  contentType: string;
  averageReach: number | null;
  averageViews: number | null;
  averageImpressions: number | null;
  averageEngagements: number | null;
  averageEngagementRate: number | null;
  sampleCount: number;
  confidence: number | null;
  dataSource: ForecastDataSource;
  lastCalculated: string;
  baselineVersion: string;
};

export type CampaignPerformanceContentSummary = {
  platform: string;
  contentType: string;
  publicationCount: number;
  averageReach: number | null;
  averageViews: number | null;
  averageImpressions: number | null;
  averageEngagements: number | null;
  averageEngagementRate: number | null;
  forecastVsActualRatio: number | null;
  completionRate: number | null;
  dataSource: ForecastDataSource;
};

export type CampaignPerformanceAggregate = {
  totalPublications: number;
  completedPublications: number;
  completionRate: number | null;
  forecastVsActualAvg: number | null;
  contentSummaries: CampaignPerformanceContentSummary[];
  dataSource: ForecastDataSource;
};

export type ForecastProfileFreshness = {
  lastEnrichedAt: string | null;
  metricsLastSyncedAt: string | null;
  dataFreshnessDays: number | null;
  isVerified: boolean;
  dnaCompleteness: number | null;
};

export type ForecastProfileConfidence = {
  score: number;
  label: "low" | "medium" | "high";
};

export type ForecastProfileDiagnostics = {
  forecastReady: boolean;
  readiness: ForecastReadiness;
  historicalSampleCount: number;
  baselineSampleCount: number;
  primaryBaselineSource: ForecastDataSource | null;
  confidenceScore: number;
  confidenceLabel: "low" | "medium" | "high";
  lastUpdatedLabel: string;
  reasons: string[];
  sourceMapping: Array<{ section: string; source: ForecastDataSource; detail: string }>;
};

export type CreatorForecastProfileVersioning = {
  profileVersion: typeof FORECAST_PROFILE_VERSION;
  baselineVersion: string;
  historicalDataVersion: string;
  generatedAt: string;
  lastRefreshed: string;
};

/** Single normalized creator forecasting profile — SSOT for all modules. */
export type CreatorForecastProfile = Readonly<{
  versioning: CreatorForecastProfileVersioning;
  identity: CreatorForecastIdentity;
  primaryPlatform: string | null;
  platforms: string[];
  audience: CreatorForecastAudience;
  followers: number | null;
  engagement: CreatorForecastEngagement;
  historicalPerformance: NormalizedHistoricalPerformance;
  publicationPerformance: {
    recentPublications: NormalizedPublicationMetric[];
    totalSamples: number;
  };
  campaignPerformance: CampaignPerformanceAggregate;
  forecastBaselines: CreatorPerformanceBaseline[];
  freshness: ForecastProfileFreshness;
  confidence: ForecastProfileConfidence;
  readiness: ForecastReadiness;
  diagnostics: ForecastProfileDiagnostics;
  /** Commercial deliverables attached at profile build time (quotations, studio slate). */
  forecastContext?: {
    deliverables?: import("../types").CampaignForecastDeliverableInput[];
  };
}>;

export type ForecastProfileManualSnapshot = {
  creatorKey: string;
  displayName?: string | null;
  handle?: string | null;
  followers?: number | null;
  primaryPlatform?: string | null;
  engagementRate?: number | null;
  categories?: string[];
};

export type ForecastProfileSourceContext = {
  /** Pre-loaded unified browse row — richest sync source. */
  unified?: import("@/lib/domains/creator/types").UnifiedCreatorResult;
  /** Minimal roster snapshot when unified data is unavailable (quotations, shortlists, studio cards). */
  manualSnapshot?: ForecastProfileManualSnapshot;
  /** Stored baselines from DB. */
  baselines?: CreatorPerformanceBaseline[];
  /** Metrics history time-series. */
  metricsHistory?: {
    followers: NormalizedHistoricalMetricPoint[];
    engagementRate: NormalizedHistoricalMetricPoint[];
    avgViews: NormalizedHistoricalMetricPoint[];
    postingFrequency: NormalizedHistoricalMetricPoint[];
    source: ForecastDataSource;
  };
  /** Campaign publication rows aggregated for this creator. */
  campaignPublications?: Array<{
    platform: string | null;
    publication_type: string | null;
    reach: number | null;
    forecast_reach: number | null;
    actual_reach: number | null;
    impressions: number | null;
    views: number | null;
    engagements: number | null;
    engagement_rate: number | null;
    metrics_refresh_status: string | null;
  }>;
  /** Commercial deliverables when building from quotation/shortlist context. */
  deliverables?: import("../types").CampaignForecastDeliverableInput[];
  /** Override creator key when commercial roster uses duplicate keys. */
  creatorKeyOverride?: string;
  preferredPlatforms?: string[];
};
