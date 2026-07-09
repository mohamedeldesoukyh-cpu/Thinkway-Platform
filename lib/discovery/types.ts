export const DISCOVERY_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
] as const;

export type DiscoveryPlatform = (typeof DISCOVERY_PLATFORMS)[number];

export const DISCOVERY_STAGES = [
  "discovered",
  "basic_enriched",
  "metrics_enriched",
  "ai_scored",
  "verified",
] as const;

export type DiscoveryProfileStage = (typeof DISCOVERY_STAGES)[number];

export const DISCOVERY_METHODS = [
  "hashtag",
  "competitor",
  "location",
  "trend",
  "manual",
] as const;

export type DiscoveryMethod = (typeof DISCOVERY_METHODS)[number];

export const DEFAULT_HASHTAG_SEEDS = [
  "fashion",
  "beauty",
  "الرياضة",
  "food",
  "tech",
  "travel",
  "lifestyle",
  "makeup",
  "gaming",
] as const;

export const LOCATION_DISCOVERY_TARGETS = [
  { country: "AE", label: "UAE creators", queries: ["dubai", "uae", "abudhabi"] },
  { country: "SA", label: "KSA creators", queries: ["riyadh", "ksa", "jeddah"] },
  { country: "EG", label: "Egypt creators", queries: ["cairo", "egypt", "alexandria"] },
] as const;

export type DiscoveredProfileRow = {
  id: string;
  platform: DiscoveryPlatform;
  username: string;
  profile_url: string;
  display_name: string | null;
  bio: string | null;
  profile_image_url: string | null;
  email_in_bio: string | null;
  country_code: string | null;
  city: string | null;
  language_codes: string[];
  category_tags: string[];
  stage: DiscoveryProfileStage;
  refresh_tier: "top" | "medium" | "inactive";
  authenticity_score: number | null;
  thinkway_score: number | null;
  source_confidence: number | null;
  metric_confidence: Record<string, unknown>;
  influencer_id: string | null;
  first_discovered_at: string;
  last_enriched_at: string | null;
  next_refresh_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileMetricsSnapshot = {
  followers: number;
  following: number;
  posts_count: number;
  avg_likes: number | null;
  avg_comments: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  posting_frequency_per_week: number | null;
  reels_views_avg: number | null;
  captured_at: string;
};

export type ProfileAiScore = {
  category: string | null;
  niche: string | null;
  audience_type: string | null;
  content_quality_score: number | null;
  luxury_level_score: number | null;
  brand_fit_score: number | null;
  professionalism_score: number | null;
  influencer_summary: string | null;
  audience_persona: string | null;
  content_style: string | null;
  scored_at: string;
};

export type DiscoverySearchFilters = {
  q?: string;
  platform?: DiscoveryPlatform;
  country?: string;
  city?: string;
  /** @deprecated Prefer `categories` for multi-select OR filtering. */
  category?: string;
  categories?: string[];
  language?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  minViews?: number;
  stage?: DiscoveryProfileStage;
  page?: number;
  pageSize?: number;
};

export type DiscoverySearchResult = {
  profiles: Array<
    DiscoveredProfileRow & {
      latest_metrics: ProfileMetricsSnapshot | null;
      latest_ai_score: ProfileAiScore | null;
    }
  >;
  total: number;
  page: number;
  pageSize: number;
};

export type DiscoveryJobPayload = {
  method: DiscoveryMethod;
  platform?: DiscoveryPlatform;
  hashtag?: string;
  seedProfileId?: string;
  seedUsername?: string;
  locationCountry?: string;
  locationQuery?: string;
  trendKey?: string;
  limit?: number;
  /** Release 1.2 — coverage miss backfill metadata. */
  triggeredBy?: "coverage_miss";
  coverageIntent?: {
    industry?: string;
    country?: string;
    categories?: string[];
    platforms?: string[];
  };
  searchId?: string;
};

export type EnrichmentJobPayload = {
  profileId: string;
  targetStage?: DiscoveryProfileStage;
};

export type CampaignMatchRequest = {
  brief: string;
  campaignHeaderId?: string;
  platform?: DiscoveryPlatform;
  country?: string;
  limit?: number;
};

export type CampaignMatchResult = {
  profile_id: string;
  username: string;
  platform: DiscoveryPlatform;
  display_name: string | null;
  match_score: number;
  rationale: string;
  predicted_performance: {
    estimated_engagement_rate: number | null;
    estimated_reach_band: string | null;
    brand_fit: number | null;
  };
};

export const DISCOVERY_JOB_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export type DiscoveryJobStatus = (typeof DISCOVERY_JOB_STATUSES)[number];

export type DiscoveryJobLogLevel = "info" | "warn" | "error";

export type DiscoveryJobLogEntry = {
  at: string;
  level: DiscoveryJobLogLevel;
  message: string;
};

export type DiscoveryJobOutcome =
  | "crawl_success"
  | "seeded_fallback"
  | "partial_success"
  | "crawl_blocked"
  | "empty";

export type DiscoveryJobResultPayload = {
  discovered?: number;
  profiles_added?: number;
  crawl_discovered?: number;
  profiles_enriched?: number;
  seeded?: boolean;
  seed_count?: number;
  outcome?: DiscoveryJobOutcome;
  crawl_error?: string | null;
  usernames?: string[];
  logs?: DiscoveryJobLogEntry[];
  method?: string;
  platform?: string;
  profile_id?: string;
};

export type DiscoveryJobRow = {
  id: string;
  job_type: string;
  method: DiscoveryMethod | null;
  status: DiscoveryJobStatus;
  payload: Record<string, unknown>;
  result: DiscoveryJobResultPayload | null;
  profiles_discovered: number;
  profiles_enriched: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type DiscoveryJobStats = {
  profiles: number;
  runningJobs: number;
  shortlists: number;
  completedJobs: number;
  failedJobs: number;
  profilesAddedToday: number;
};

export type DiscoveryBrowseBackfillMeta = {
  searchId: string;
  /** True when a background acquisition job was enqueued for this search. */
  acquisitionStarted?: boolean;
  acquisitionJobId?: string;
  /** All platform acquisition jobs when brief lists multiple platforms. */
  acquisitionJobIds?: string[];
  /** Human-readable acquisition status for the UI (e.g. "Acquiring creators..."). */
  status?: string;
  apifyExecuted: boolean;
  queued: boolean;
  completed: boolean;
  jobId?: string;
  profilesAdded?: number;
  reason: string;
  waitedMs: number;
  /** Sprint 3 — dataset acquisition vs legacy worker. */
  acquisitionMode?: "dataset_import" | "legacy_worker";
  /** Intelligence sufficiency snapshot when dataset acquisition gate is active. */
  intelligenceSufficiency?: {
    sufficient: boolean;
    sufficiencyScore: number;
    sufficiencyLevel: string;
    intelligenceGaps: string[];
    gapReasons: string[];
  };
  datasetAcquisition?: {
    apifyRunId: string | null;
    datasetId: string | null;
    creatorsImported: number;
    creatorsMerged: number;
    enrichmentJobsQueued: number;
  };
};

export type DiscoveryBrowseWithBackfillResult = import("@/lib/creators/types").UnifiedCreatorBrowseResult & {
  backfill?: DiscoveryBrowseBackfillMeta;
};
