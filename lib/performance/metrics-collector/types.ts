export const METRICS_REFRESH_STATUSES = [
  "queued",
  "pending",
  "collecting",
  "completed",
  "partial",
  "manual_required",
  "failed",
] as const;

export type MetricsRefreshStatus = (typeof METRICS_REFRESH_STATUSES)[number];

export const METRICS_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
] as const;

export type MetricsPlatform = (typeof METRICS_PLATFORMS)[number];

/** Platform resolved from URL + publication row (may be unknown when undetectable). */
export type DetectionPlatform = MetricsPlatform | "unknown";

export type MetricsProviderId =
  | "meta_graph_api"
  | "brightdata"
  | "apify"
  | "playwright"
  | "tiktok_api"
  | "youtube_data_api"
  | "youtube_public_metadata"
  | "facebook_graph_api"
  | "snapchat_api"
  | "manual_import"
  | "manual"
  | "engagement_engine";

export type CollectedMetrics = {
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagements: number | null;
  engagement_rate: number | null;
  plays: number | null;
  clicks: number | null;
};

export type PublicationContentSource = "sync" | "derived" | "manual";

export type PublicationContent = {
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  hashtag_count: number;
  mention_count: number;
  caption_source: PublicationContentSource;
  hashtags_source: PublicationContentSource;
  mentions_source: PublicationContentSource;
};

export type PublicationForCollection = {
  id: string;
  campaign_header_id: string;
  platform: string;
  content_url: string | null;
  external_media_id: string | null;
  publication_type: string;
  publication_date?: string | null;
  status?: string | null;
  created_at?: string | null;
};

export type ProviderAttemptResult = {
  provider: MetricsProviderId;
  available: boolean;
  skippedReason?: string;
  error?: string;
  errorCode?: string;
  metrics?: Partial<CollectedMetrics>;
  /** Caption, hashtags, mentions extracted from provider payload. */
  publicationContent?: PublicationContent | null;
  /** Platform post date extracted from provider payload (YYYY-MM-DD). */
  publicationDate?: string | null;
  complete?: boolean;
  durationMs?: number;
  requestPayload?: Record<string, unknown>;
  responseSummary?: Record<string, unknown>;
};

export type CollectionTrigger =
  | "auto_create"
  | "manual_refresh"
  | "bulk_refresh"
  | "scheduled_cron"
  | "scheduled_worker"
  | "manual_import"
  | "manual_restore_automatic";

export type CollectionOutcome = {
  publicationId: string;
  status: MetricsRefreshStatus;
  source: MetricsProviderId | null;
  confidence: number | null;
  metrics: Partial<CollectedMetrics>;
  attempts: ProviderAttemptResult[];
  message: string;
};

export type PlaywrightMetricsExtractFn = (
  url: string,
  platform: MetricsPlatform | string
) => Promise<(Partial<CollectedMetrics> & { publicationDate?: string | null }) | null>;

export type MetricsCollectorOptions = {
  triggeredBy: CollectionTrigger | string;
  playwrightExtract?: PlaywrightMetricsExtractFn;
};

export type CampaignMetricsSyncHealth = {
  synced: number;
  partial: number;
  failed: number;
  manual_required: number;
  queued: number;
  collecting: number;
  total: number;
};
