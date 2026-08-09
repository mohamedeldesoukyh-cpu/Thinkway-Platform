/**
 * Phase 3 — production creator enrichment shared types.
 * Consumed by Next.js server actions AND the discovery worker (via @/ alias).
 */

/** Why an enrichment job was created. Drives priority (see {@link priorityForTrigger}). */
export type EnrichmentTrigger =
  | "campaign" // creator moved Approved shortlist -> campaign (HIGH)
  | "shortlist" // creator added to a shortlist
  | "detail" // creator detail sheet opened
  | "manual" // explicit "Refresh Creator" click
  | "stale"; // scheduled/background refresh of stale data

/** BullMQ-aligned business priority. Lower number = higher priority. */
export type EnrichmentPriority = 1 | 2 | 3 | 4;

/**
 * Transparency source for every enriched field. Stored in `field_sources` jsonb.
 * `manual` values are NEVER overwritten automatically by enrichment.
 */
export type FieldSource =
  | "actual"
  | "forecast"
  | "manual"
  | "imported"
  | "apify";

export type FieldSourceMap = Record<string, FieldSource>;

export type DemographicSource =
  | "unavailable"
  | "modash"
  | "hypeauditor"
  | "creatoriq"
  | "apify"
  | "manual";

export type CreatorEnrichmentStatus =
  | "never"
  | "queued"
  | "running"
  | "enriched"
  | "partial"
  | "awaiting_profile_details"
  | "failed"
  | "skipped";

/** Manual refresh scope — Apify returns a full profile; the worker applies only these fields. */
export type EnrichmentScope =
  | "avatar"
  | "metrics"
  | "profile"
  | "audience"
  | "categories"
  | "all";

/** Manual refresh only — whether to reuse IPL cache or force a live Apify fetch. */
export type ManualRefreshDataSource = "cached_snapshot" | "live_apify";

/** Job payload placed on the `creator-enrichment` queue. */
export type CreatorEnrichmentJobPayload = {
  /** Primary target. Required for commercial enrichment. */
  influencerId: string;
  /** Optional discovered profile reference for audit linkage. */
  discoveredProfileId?: string | null;
  trigger: EnrichmentTrigger;
  priority: EnrichmentPriority;
  /** Which fields to persist from the provider response. Default `all` for auto; manual actions set explicitly. */
  scope?: EnrichmentScope;
  /** Explicit refresh — bypasses the 30-day freshness skip. */
  force?: boolean;
  /** Explicit Refresh Metrics — re-syncs metrics; does not replace uploaded avatars unless paired with forceAvatarReplace. */
  bypassMetricsManualOverride?: boolean;
  /** Replace a valid uploaded avatar with a provider photo. Default false. */
  forceAvatarReplace?: boolean;
  /** Replace imported/manual interests with provider values. Default false. */
  forceInterestReplace?: boolean;
  /** User who requested it (manual refresh / detail open). */
  requestedBy?: string | null;
  /** When set, only enrich this platform account (Discovery per-platform refresh). */
  platformAccountId?: string | null;
  /** Manual refresh only — cached path skips live Apify when IPL snapshot is fresh. */
  dataSource?: ManualRefreshDataSource;
};

export type EnqueueResult = {
  queued: boolean;
  reason?: string;
  jobId?: string;
  /** True when the decision engine skipped enqueue (e.g. creator already fresh). */
  skipped?: boolean;
};

/** Normalized profile snapshot returned by the Apify profile fetch. */
export type ApifyProfileData = {
  platform: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  profilePictureUrl: string | null;
  profileUrl: string | null;
  followers: number | null;
  following: number | null;
  postsCount: number | null;
  avgViews: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  /** Mean interactions per post (likes+comments+shares+saves when present). */
  avgEngagements: number | null;
  /** Mean reel/video plays across reel posts in the last 30 publications. */
  avgReelsPlays: number | null;
  engagementRate: number | null;
  isVerified: boolean | null;
  audienceCountry: string | null;
  hashtags: string[];
  mentions: string[];
  categories: string[];
  recentPublications: RecentPublication[];
  contactEmail: string | null;
  contactPhone: string | null;
  contactLinks: string[];
  apifyRunId: string | null;
};

export type RecentPublication = {
  url: string | null;
  thumbnail: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  posted_at: string | null;
  caption: string | null;
  isVideo?: boolean;
};

export type CreatorEnrichmentResult = {
  ok: boolean;
  status: CreatorEnrichmentStatus;
  message: string;
  fieldsUpdated: string[];
  skippedReason?: string;
  apifyRunId?: string | null;
};
