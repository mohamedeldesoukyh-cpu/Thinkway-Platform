/** Shared creator / influencer domain types (Discovery, Shortlists, Campaigns). */

export const CREATOR_SOURCE_TYPES = [
  "internal",
  "public_discovery",
  "oauth_verified",
  "imported",
] as const;

export type CreatorSourceType = (typeof CREATOR_SOURCE_TYPES)[number];

export const METRIC_CONFIDENCE_LEVELS = [
  "estimated",
  "inferred",
  "verified",
  "oauth_verified",
] as const;

export type MetricConfidenceLevel = (typeof METRIC_CONFIDENCE_LEVELS)[number];

export type MetricWithConfidence = {
  value: number | null;
  confidence: MetricConfidenceLevel;
};

export type UnifiedCreatorMetrics = {
  followers: MetricWithConfidence;
  engagement_rate: MetricWithConfidence;
  avg_likes: MetricWithConfidence;
  avg_comments: MetricWithConfidence;
  avg_views: MetricWithConfidence;
  posting_frequency_per_week: MetricWithConfidence;
};

export type UnifiedCreatorPlatform = {
  id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  avg_likes?: number | null;
  avg_comments?: number | null;
  avg_views?: number | null;
  audience_country: string | null;
  is_verified?: boolean;
  profile_picture_url?: string | null;
  profile_bio?: string | null;
  recent_publications?: CreatorRecentPublication[];
};

export type CreatorRecentPublication = {
  url: string | null;
  thumbnail: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  posted_at: string | null;
  caption: string | null;
};

export type CreatorEnrichmentStatus =
  | "never"
  | "queued"
  | "running"
  | "enriched"
  | "partial"
  | "failed"
  | "skipped";

export type UnifiedCreatorResult = {
  /** Stable composite key: `inf:uuid` or `dis:uuid` */
  unified_id: string;
  source_type: CreatorSourceType;
  influencer_id: string | null;
  discovered_profile_id: string | null;
  document_number: string | null;
  display_name: string;
  status: string | null;
  country_code: string | null;
  estimated_country: string | null;
  city: string | null;
  categories: string[];
  /** Stored category tags for browse filters (influencers.categories / category_tags). */
  browse_category_tags?: string[];
  /** Merged audience interests from all platform accounts (Discovery display). */
  audience_interests?: string[];
  language_codes: string[];
  /** Stable creator-level avatar (persisted on influencers.primary_avatar_url). */
  profile_image_url: string | null;
  /** Creator-level avatar for Discovery rows — always use this, never platforms[0].profile_picture_url. */
  primaryAvatarUrl?: string | null;
  primaryAvatarSource?:
    | "manual"
    | "uploaded"
    | "imported"
    | "instagram"
    | "tiktok"
    | "youtube"
    | "opengraph"
    | "placeholder"
    | null;
  /** Platform account whose metrics populate list-row KPIs until detail switcher changes view. */
  default_metrics_platform_account_id?: string | null;
  bio: string | null;
  /** Creator role/type from CSV import (e.g. Macro, Micro). */
  role?: string | null;
  metrics: UnifiedCreatorMetrics;
  ai_category: string | null;
  ai_niche: string | null;
  authenticity_score: number | null;
  thinkway_score: number;
  source_confidence: number;
  brand_fit_score: number | null;
  is_platform_verified: boolean;
  platforms: UnifiedCreatorPlatform[];
  notes?: string | null;
  suggested_currency?: string;
  enrichment_status?: CreatorEnrichmentStatus | null;
  last_enriched_at?: string | null;
  enrichment_source?: string | null;
  recent_publications?: CreatorRecentPublication[];
  /** PostgreSQL ts_rank when a full-text search query is active. */
  search_rank?: number | null;
};

export type UnifiedCreatorBrowseFilters = {
  /** Single-creator lookup (post-enrichment refresh). Not for browse UI. */
  influencerId?: string;
  /** Single discovery profile lookup (post-enrichment refresh). Not for browse UI. */
  discoveredProfileId?: string;
  search?: string;
  platform?: string;
  country?: string;
  city?: string;
  /** @deprecated Prefer `categories` for multi-select OR filtering. */
  category?: string;
  /** Match creators tagged with any of these categories (OR semantics). */
  categories?: string[];
  language?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  minViews?: number;
  minAiScore?: number;
  minThinkwayScore?: number;
  verifiedOnly?: boolean;
  source?: CreatorSourceType | "all";
  /** When true, hides mock / demo / unverified discovery placeholders. */
  productionOnly?: boolean;
  platforms?: string[];
  page?: number;
  pageSize?: number;
};

export type UnifiedCreatorBrowseResult = {
  creators: UnifiedCreatorResult[];
  total: number;
  has_more?: boolean;
  page: number;
  pageSize: number;
  internal_count: number;
  discovery_count: number;
};

export type CreatorHistoricalMetrics = {
  followers: Array<{ captured_at: string; value: number }>;
  engagement_rate: Array<{ captured_at: string; value: number }>;
  posting_frequency: Array<{ captured_at: string; value: number }>;
};

export type CampaignCreatorMatch = {
  unified_id: string;
  display_name: string;
  source_type: CreatorSourceType;
  match_score: number;
  niche_fit: number;
  engagement_quality: number;
  authenticity: number;
  estimated_roi: number;
  rationale: string;
  creator: UnifiedCreatorResult;
};

export type InfluencerSearchResult = {
  id: string;
  document_number: string;
  display_name: string;
  status: string;
  country_code: string | null;
  suggested_currency: string;
  categories?: string[];
  notes?: string | null;
  platforms: {
    id: string;
    platform: string;
    handle: string;
    profile_url: string | null;
    follower_count: number | null;
    engagement_rate: number | null;
    audience_country: string | null;
    is_verified?: boolean;
  }[];
};

export type CreatorBrowseFilters = {
  search?: string;
  platform?: string;
  country?: string;
  category?: string;
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
  page?: number;
  pageSize?: number;
};

export type CreatorBrowseResult = {
  creators: InfluencerSearchResult[];
  unified_creators?: UnifiedCreatorResult[];
  total: number;
  page: number;
  pageSize: number;
  internal_count?: number;
  discovery_count?: number;
};

export type InfluencerAssignmentProfile = InfluencerSearchResult & {
  rate_card: Record<string, unknown>;
  payment_details: Record<string, unknown>;
  suggested_cost: number;
  vat_registered: boolean;
  default_vat_percent: number;
  tax_registration_number: string | null;
  suggested_cost_vat_percent: number;
  notes?: string | null;
};
