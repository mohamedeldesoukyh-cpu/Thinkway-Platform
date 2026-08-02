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
  hashtags?: string[];
  mentions?: string[];
  recent_publications?: CreatorRecentPublication[];
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_links?: string[];
  /** Last metrics sync provider (e.g. apify, discovery_add). */
  sync_source?: string | null;
  sync_status?: string | null;
  sync_error?: string | null;
  enrichment_status?: CreatorEnrichmentStatus | null;
  metadata?: Record<string, unknown> | null;
};

export type CreatorRecentPublication = {
  url: string | null;
  thumbnail: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  posted_at: string | null;
  caption: string | null;
  /** True for reels, TikTok, YouTube, etc. — persisted from enrichment when known. */
  isVideo?: boolean;
};

export type CreatorEnrichmentStatus =
  | "never"
  | "queued"
  | "running"
  | "enriched"
  | "partial"
  | "awaiting_profile_details"
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
  /** All creator location countries (ISO-2) — bio-inferred + enrichment. */
  country_codes?: string[] | null;
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
  /** Top hashtags from recent posts (Apify enrichment). */
  hashtags?: string[];
  /** Top @mentions from recent posts (Apify enrichment). */
  mentions?: string[];
  /** Business/public email from enrichment or import. */
  contact_email?: string | null;
  /** Public phone when available from enrichment or import. */
  contact_phone?: string | null;
  /** External URLs (website, bio link, etc.). */
  contact_links?: string[];
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
  /** Manual average price per content (`influencers.rate_card`). */
  rate_card?: Record<string, unknown> | null;
  enrichment_status?: CreatorEnrichmentStatus | null;
  last_enriched_at?: string | null;
  /** Row touch time — used for browse recency when enrichment has not run yet. */
  updated_at?: string | null;
  enrichment_source?: string | null;
  recent_publications?: CreatorRecentPublication[];
  /** PostgreSQL ts_rank when a full-text search query is active. */
  search_rank?: number | null;
  /** Cached Creator DNA completeness 0..100 (Phase 2). */
  dna_completeness?: number;
  /** Normalized historical performance signal 0..1 for ranking. */
  historical_performance_score?: number;
  /** Field paths requiring verified provider data. */
  dna_verification_required?: string[];
  /** Audience demographics from enrichment (Modash / Apify) when available. */
  audience_demographics?: import("@/features/discovery/enrichment/components/audience-demographics-section").AudienceDemographics;
  /** Release 1.2 — browse-only metadata from Discovery Control Center (not persisted). */
  browse_metadata?: {
    data_may_be_outdated?: boolean;
    data_age_days?: number | null;
  };
  /** Campaign brief weighted relevance (0–100) — browse-only, set by AI search scoring. */
  campaign_relevance_score?: number | null;
  /**
   * Enterprise Creator Intelligence investment score (0–100) — browse-only overlay.
   * Card / Detail / Compare investment display SSOT. Loaded via loadCreatorIntelligenceBundles.
   * Never use thinkway_score / brand_fit_score as investment SSOT when this is present.
   */
  eci_investment_score?: number | null;
  /** ECI investment recommendation label — browse-only overlay. */
  eci_investment_recommendation?: string | null;
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
  /** Creator language OR filter — first entry may be sent to SQL; all apply client-side. */
  languages?: string[];
  /** Content language OR filter — client-side only on language_codes. */
  contentLanguages?: string[];
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
  /** Creator location OR filter (Discovery UI `countries`). */
  creatorCountries?: string[];
  /** Audience geography chips — OR match against demographics / platform audience country. */
  audienceCountries?: string[];
  /** Audience interest chips — OR match against categories / niche / interests. */
  audienceInterestTags?: string[];
  /** Audience gender chip (`male` / `female`). Uses demographic share when enriched. */
  audienceGender?: string;
  audienceAgeMin?: string;
  audienceAgeMax?: string;
  /** Release 1.2 — intent signals for coverage evaluation on AI browse path. */
  coverageIntent?: {
    country?: string;
    categories?: string[];
    niches?: string[];
    platforms?: string[];
    audience?: string;
    minFollowers?: number;
    maxFollowers?: number;
    searchConfidence?: number;
  };
  /** When true, skip async acquisition enqueue (post-acquisition refresh browse). */
  skipCoverageBackfill?: boolean;
  /** Client-generated UUID per Creator Search session — ties acquisition to active UI session. */
  searchSessionId?: string;
  /** Campaign Intelligence Profile id — acquisition cooldown + audit dedup. */
  campaignIntelligenceProfileId?: string;
  /** Batch lookup by influencer UUID — used for post-acquisition result hydration. */
  influencerIds?: string[];
};

export type UnifiedCreatorBrowseResult = {
  creators: UnifiedCreatorResult[];
  total: number;
  has_more?: boolean;
  page: number;
  pageSize: number;
  internal_count: number;
  discovery_count: number;
  coverage?: import("@/lib/creators/discovery-coverage").DiscoveryCoverageEvaluation;
  /** Release 1.2 — backfill metadata when Discovery browse triggers coverage miss path. */
  backfill?: import("@/lib/discovery/types").DiscoveryBrowseBackfillMeta;
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
