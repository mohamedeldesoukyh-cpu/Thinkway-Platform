/**
 * Canonical column requirements for Campaign Performance Center.
 * Do not assume these exist in production — always validate via schema runtime.
 */

export const CAMPAIGN_PUBLICATIONS_TABLE = "campaign_publications" as const;

/** Minimum columns required for the Performance Center to load (grid + KPI counts). */
export const CAMPAIGN_PUBLICATIONS_REQUIRED_COLUMNS = [
  "id",
  "campaign_header_id",
  "platform",
  "publication_type",
  "content_url",
  "publication_date",
  "status",
  "created_at",
] as const;

/** Core identity / linkage fields used by grid and exports. */
export const CAMPAIGN_PUBLICATIONS_CORE_COLUMNS = [
  "campaign_line_id",
  "assignment_deliverable_id",
  "assignment_post_schedule_id",
  "influencer_id",
  "assignee_id",
  "caption",
  "hashtags",
  "notes",
  "auto_detected",
  "updated_at",
] as const;

/** Content enrichment */
export const CAMPAIGN_PUBLICATIONS_CONTENT_COLUMNS = [
  "mentions",
  "hashtag_count",
  "mention_count",
  "caption_source",
  "hashtags_source",
  "mentions_source",
  "thumbnail_url",
  "screenshot_url",
  "screenshot_captured_at",
  "screenshot_source",
] as const;

/** Reach / engagement / video metrics */
export const CAMPAIGN_PUBLICATIONS_METRIC_COLUMNS = [
  "impressions",
  "impressions_source",
  "forecast_impressions",
  "actual_impressions",
  "reach",
  "reach_source",
  "forecast_reach",
  "actual_reach",
  "views",
  "unique_views",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "plays",
  "watch_time_seconds",
  "average_watch_time_seconds",
  "completion_rate",
] as const;

/** Stored calculated commercial metrics */
export const CAMPAIGN_PUBLICATIONS_CALCULATED_COLUMNS = [
  "engagement_rate",
  "engagement_rate_method",
  "view_rate",
  "cpm",
  "cpv",
  "cpe",
  "cpc",
  "cost",
  "currency",
] as const;

/** AI insight scores */
export const CAMPAIGN_PUBLICATIONS_AI_COLUMNS = [
  "sentiment_score",
  "brand_safety_score",
  "authenticity_score",
] as const;

/** Sync / detection metadata */
export const CAMPAIGN_PUBLICATIONS_SYNC_COLUMNS = [
  "last_synced_at",
  "sync_status",
  "sync_source",
  "api_sync_status",
  "detection_source",
  "detected_by",
  "external_media_id",
  "matched_hashtag",
  "metrics_refresh_status",
  "metrics_refresh_attempted_at",
  "metrics_next_refresh_at",
  "metrics_collection_source",
  "metrics_provider",
  "metrics_confidence",
  "engagements",
] as const;

/** Legacy engagement columns (pre–Performance Center migration) */
export const CAMPAIGN_PUBLICATIONS_LEGACY_ENGAGEMENT_COLUMNS = [
  "engagement_views",
  "engagement_likes",
  "engagement_comments",
  "engagement_shares",
] as const;

/** All columns the application may read (union, deduped). */
export const CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS = [
  ...new Set([
    ...CAMPAIGN_PUBLICATIONS_REQUIRED_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_CORE_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_CONTENT_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_METRIC_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_CALCULATED_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_AI_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_SYNC_COLUMNS,
    ...CAMPAIGN_PUBLICATIONS_LEGACY_ENGAGEMENT_COLUMNS,
  ]),
] as const;

export type CampaignPublicationColumn =
  (typeof CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS)[number];

export const CAMPAIGN_PUBLICATIONS_EXPECTED_MIGRATION =
  "20260623120000_campaign_publications_full_schema_reconcile.sql";

export const CAMPAIGN_PUBLICATIONS_REACH_FORECAST_MIGRATION =
  "20260630130000_reach_forecasting.sql";

export const CAMPAIGN_PUBLICATIONS_IMPRESSIONS_FORECAST_MIGRATION =
  "20260630150000_impressions_forecasting.sql";

export const CAMPAIGN_PUBLICATIONS_SCREENSHOT_MIGRATION =
  "20260625120000_campaign_publication_screenshots.sql";

export function partitionSchemaColumns(available: Set<string>) {
  const missingRequired = CAMPAIGN_PUBLICATIONS_REQUIRED_COLUMNS.filter(
    (c) => !available.has(c)
  );
  const missingMetrics = CAMPAIGN_PUBLICATIONS_METRIC_COLUMNS.filter(
    (c) => !available.has(c)
  );
  const missingCalculated = CAMPAIGN_PUBLICATIONS_CALCULATED_COLUMNS.filter(
    (c) => !available.has(c)
  );
  const missingAi = CAMPAIGN_PUBLICATIONS_AI_COLUMNS.filter((c) => !available.has(c));
  const missingSync = ["last_synced_at", "sync_status", "sync_source"].filter(
    (c) => !available.has(c)
  );
  const missingLegacy = CAMPAIGN_PUBLICATIONS_LEGACY_ENGAGEMENT_COLUMNS.filter(
    (c) => !available.has(c)
  );
  const missingContent = CAMPAIGN_PUBLICATIONS_CONTENT_COLUMNS.filter(
    (c) => !available.has(c)
  );

  return {
    missingRequired,
    missingMetrics,
    missingCalculated,
    missingAi,
    missingSync,
    missingLegacy,
    missingContent,
    isCompatible: missingRequired.length === 0,
  };
}

export function buildPublicationSelectList(available: Set<string>): string {
  const columns = CAMPAIGN_PUBLICATIONS_ALL_APP_COLUMNS.filter((c) => available.has(c));
  return columns.join(",\n  ");
}

export function filterWritePayload(
  payload: Record<string, unknown>,
  available: Set<string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (available.has(key)) out[key] = value;
  }
  return out;
}
