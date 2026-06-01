import type { ProfileEnrichmentPayload } from "@/lib/social/enrich-platform-account";
import {
  mapEnrichmentToSyncStatus,
  resolveMetricsSourceForEnrichment,
  type MetricsSource,
  type PlatformSyncStatus,
} from "@/lib/social/enrichment/metrics-status";

export type EnrichableMetricFields = {
  follower_count: string;
  following_count: string;
  engagement_rate: string;
  avg_views: string;
  metrics_source: MetricsSource;
  metrics_last_synced_at: string;
  metrics_is_manual_override: boolean;
  sync_status: string;
  sync_source: string;
  sync_error: string;
  last_synced_at: string;
  metric_field_sources: {
    followers: MetricsSource;
    engagement: MetricsSource;
    avg_views: MetricsSource;
  };
};

export type EnrichableProfileFields = EnrichableMetricFields & {
  platform: string;
  username: string;
  profile_url: string;
  profile_display_name: string;
  profile_bio: string;
  profile_picture_url: string;
  is_verified: boolean;
  duplicate_warning: string;
};

function hasSyncedMetricValue(
  enrichmentValue: number | null | undefined,
  currentValue: string,
  isManualOverride: boolean
): boolean {
  return (
    enrichmentValue != null &&
    !isManualOverride &&
    (currentValue === "" || currentValue === "0")
  );
}

export function applyProfileEnrichment<T extends EnrichableProfileFields>(
  account: T,
  payload: ProfileEnrichmentPayload,
  options?: { preserveManualMetrics?: boolean }
): T {
  const { parsed, enrichment, duplicates } = payload;
  const preserveManual = options?.preserveManualMetrics ?? account.metrics_is_manual_override;

  const next: T = {
    ...account,
    platform: parsed.platform,
    username: parsed.username,
    profile_url: parsed.profile_url,
    duplicate_warning:
      duplicates.length > 0
        ? `Already linked to ${duplicates[0].influencer_name}`
        : "",
  };

  if (!enrichment) {
    next.sync_status = "partial";
    next.sync_source = "url_parse";
    next.last_synced_at = new Date().toISOString();
    next.metrics_last_synced_at = next.last_synced_at;
    if (!preserveManual) {
      const source = resolveMetricsSourceForEnrichment({
        platform: parsed.platform,
        follower_count: null,
        engagement_rate: null,
        avg_views: null,
        sync_status: "partial",
      });
      next.metrics_source = source;
      next.metric_field_sources = {
        followers: source,
        engagement: source,
        avg_views: source,
      };
    }
    return next;
  }

  if (enrichment.display_name && !account.profile_display_name.trim()) {
    next.profile_display_name = enrichment.display_name;
  }
  if (enrichment.bio && !account.profile_bio.trim()) {
    next.profile_bio = enrichment.bio;
  }
  if (enrichment.profile_picture_url && !account.profile_picture_url.trim()) {
    next.profile_picture_url = enrichment.profile_picture_url;
  }
  if (enrichment.is_verified != null) {
    next.is_verified = enrichment.is_verified;
  }

  const metricFields = { ...next.metric_field_sources };
  const manualOverride = preserveManual;

  if (
    hasSyncedMetricValue(
      enrichment.follower_count,
      account.follower_count,
      manualOverride
    )
  ) {
    next.follower_count = String(enrichment.follower_count);
    metricFields.followers = "synced";
  }

  if (
    hasSyncedMetricValue(
      enrichment.following_count,
      account.following_count,
      manualOverride
    ) &&
    enrichment.following_count != null
  ) {
    next.following_count = String(enrichment.following_count);
  }

  if (
    hasSyncedMetricValue(
      enrichment.engagement_rate,
      account.engagement_rate,
      manualOverride
    )
  ) {
    next.engagement_rate = String(enrichment.engagement_rate);
    metricFields.engagement = "synced";
  }

  if (
    hasSyncedMetricValue(enrichment.avg_views, account.avg_views, manualOverride)
  ) {
    next.avg_views = String(enrichment.avg_views);
    metricFields.avg_views = "synced";
  }

  const hasMetricValues =
    enrichment.follower_count != null ||
    enrichment.engagement_rate != null ||
    enrichment.avg_views != null;

  const syncStatus = mapEnrichmentToSyncStatus(
    enrichment.sync_status as PlatformSyncStatus,
    parsed.platform,
    hasMetricValues
  );

  next.sync_status = syncStatus;
  next.sync_source = enrichment.sync_source;
  next.sync_error = enrichment.sync_error ?? "";
  next.last_synced_at = new Date().toISOString();
  next.metrics_last_synced_at = next.last_synced_at;

  if (!manualOverride) {
    next.metrics_source = resolveMetricsSourceForEnrichment({
      platform: parsed.platform,
      follower_count: enrichment.follower_count,
      engagement_rate: enrichment.engagement_rate,
      avg_views: enrichment.avg_views,
      sync_status: syncStatus,
    });
    next.metrics_is_manual_override = false;
    next.metric_field_sources = {
      followers: metricFields.followers,
      engagement: metricFields.engagement,
      avg_views: metricFields.avg_views,
    };
  } else {
    next.metric_field_sources = {
      followers: account.follower_count.trim()
        ? account.metric_field_sources.followers
        : metricFields.followers,
      engagement: account.engagement_rate.trim()
        ? account.metric_field_sources.engagement
        : metricFields.engagement,
      avg_views: account.avg_views.trim()
        ? account.metric_field_sources.avg_views
        : metricFields.avg_views,
    };
  }

  return next;
}
