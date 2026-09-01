import type { PostPerformanceAnalysis } from "./post-performance";

export const CREATOR_INSIGHT_RECOMMENDATION_TYPES = [
  "performance_trend",
  "strong_content_type",
  "engagement_opportunity",
  "publication_timing",
  "campaign_specific",
  "data_enrichment",
] as const;

export type CreatorInsightRecommendationType =
  (typeof CREATOR_INSIGHT_RECOMMENDATION_TYPES)[number];

export const CREATOR_INSIGHT_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export type CreatorInsightConfidence = (typeof CREATOR_INSIGHT_CONFIDENCE_LEVELS)[number];

/** Internal only — never show Level 0/1/2 to the creator. */
export type CreatorInsightDataLevel = 0 | 1 | 2;

export type ContentFormatFamily =
  | "short_video"
  | "story"
  | "static_post"
  | "carousel"
  | "long_video"
  | "live"
  | "other";

export type CreatorInsightMetricKey =
  | "views"
  | "reach"
  | "impressions"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "engagementRate"
  | "followers";

export type NullableMetrics = {
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagementRate: number | null;
  followers: number | null;
};

export type CreatorInsightEvidence = {
  label: string;
  value: string;
};

export type CreatorInsightFactMap = Record<string, number | string | boolean | null>;

export type DetectedCreatorInsight = {
  type: CreatorInsightRecommendationType;
  confidence: CreatorInsightConfidence;
  facts: CreatorInsightFactMap;
  evidence: CreatorInsightEvidence[];
  sampleSize: number;
  metricKey: CreatorInsightMetricKey | null;
  campaignHeaderId: string | null;
  assignmentDeliverableId: string | null;
  formatFamily: ContentFormatFamily | null;
  platform: string | null;
  priority: number;
};

export type CreatorFacingRecommendation = {
  id: string;
  influencerId: string;
  type: CreatorInsightRecommendationType;
  title: string;
  explanation: string;
  recommendation: string;
  confidence: CreatorInsightConfidence;
  evidence: CreatorInsightEvidence[];
  facts: CreatorInsightFactMap;
  generatedAt: string;
  expiresAt: string | null;
  sourceDataTimestamp: string | null;
  lastSyncedAt: string | null;
  stale: boolean;
  campaignHeaderId: string | null;
  assignmentDeliverableId: string | null;
  href: string | null;
  wordingSource: "deterministic" | "ai";
};

export type UnitCompactInsight = {
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  campaignHeaderId: string;
  line: string;
};

export type CreatorInsightPack = {
  influencerId: string;
  generatedAt: string;
  dataLevel: CreatorInsightDataLevel;
  dataAvailabilityLabel: string;
  stale: boolean;
  lastSyncedAt: string | null;
  sourceDataTimestamp: string | null;
  connectedPlatforms: Array<{
    provider: string;
    displayName: string;
    status: string;
    lastSyncedAt: string | null;
  }>;
  recommendations: CreatorFacingRecommendation[];
  unitInsights: UnitCompactInsight[];
  postAnalyses: PostPerformanceAnalysis[];
  collectingMessage: string | null;
};

export type UpcomingCreatorUnit = {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  deliverableType: string;
  platform: string | null;
  status: string;
  label: string;
};

export const MAX_SURFACED_RECOMMENDATIONS = 3;
export const STALE_SYNC_MS = 14 * 24 * 60 * 60 * 1000;
export const MIN_TREND_EACH_SIDE = 3;
export const MIN_FORMAT_EACH = 3;
export const MIN_TIMING_SAMPLE = 8;
export const MIN_ENGAGEMENT_SAMPLE = 5;
export const MIN_UNIT_BASELINE = 5;
export const MIN_RELATIVE_DELTA = 0.1;
