import type { SocialPlatform } from "../platforms";

export type PlatformSyncStatus =
  | "pending"
  | "synced"
  | "partial"
  | "failed"
  | "manual"
  | "pending_api";

export type MetricsSource =
  | "synced"
  | "manual"
  | "unavailable"
  | "pending_api";

export type MetricField = "followers" | "engagement" | "avg_views";

export const API_METRICS_PLATFORMS: SocialPlatform[] = ["instagram", "snapchat"];

export const SYNC_STATUS_LABELS: Record<PlatformSyncStatus, string> = {
  synced: "Synced",
  partial: "Partial",
  manual: "Manual",
  failed: "Failed",
  pending: "Pending",
  pending_api: "Pending API",
};

export const METRICS_SOURCE_LABELS: Record<MetricsSource, string> = {
  synced: "Synced",
  manual: "Manual",
  unavailable: "Not available",
  pending_api: "Pending API",
};

export function getPlatformMetricsHelper(platform: string): string | null {
  switch (platform) {
    case "instagram":
      return "Instagram public metrics may require API connection.";
    case "snapchat":
      return "Snapchat metrics may require API connection.";
    case "tiktok":
      return "TikTok follower counts may require Creator API connection.";
    default:
      return null;
  }
}

export function resolveMetricsSourceForEnrichment(input: {
  platform: string;
  follower_count: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  sync_status: PlatformSyncStatus;
}): MetricsSource {
  if (
    input.follower_count != null ||
    input.engagement_rate != null ||
    input.avg_views != null
  ) {
    return "synced";
  }

  if (API_METRICS_PLATFORMS.includes(input.platform as SocialPlatform)) {
    return "pending_api";
  }

  if (input.sync_status === "failed") {
    return "unavailable";
  }

  return "unavailable";
}

export function metricValueToInput(
  value: number | null | undefined,
  metricsSource: MetricsSource | null | undefined,
  isManualOverride: boolean
): string {
  if (value == null) {
    return "";
  }

  if (
    value === 0 &&
    !isManualOverride &&
    (metricsSource === "unavailable" || metricsSource === "pending_api")
  ) {
    return "";
  }

  return String(value);
}

export function metricInputToStorage(
  value: string,
  isManualOverride: boolean
): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  if (Number.isNaN(parsed)) {
    return null;
  }

  if (parsed === 0 && !isManualOverride) {
    return null;
  }

  return parsed;
}

export function getMetricPlaceholder(input: {
  value: string;
  fieldSource: MetricsSource;
  isManualOverride: boolean;
}): string {
  if (input.value.trim()) {
    return "Enter value";
  }

  if (input.isManualOverride || input.fieldSource === "manual") {
    return "Manual input required";
  }

  if (input.fieldSource === "pending_api") {
    return "Pending API — manual input required";
  }

  return "Not available";
}

export function resolveFieldMetricsSource(input: {
  value: string;
  accountMetricsSource: MetricsSource;
  isManualOverride: boolean;
  wasSyncedFromEnrichment: boolean;
}): MetricsSource {
  if (input.isManualOverride && input.value.trim()) {
    return "manual";
  }

  if (input.wasSyncedFromEnrichment && input.value.trim()) {
    return "synced";
  }

  if (input.value.trim()) {
    return input.accountMetricsSource === "manual" ? "manual" : "synced";
  }

  return input.accountMetricsSource;
}

export function mapEnrichmentToSyncStatus(
  syncStatus: PlatformSyncStatus,
  platform: string,
  hasMetricValues: boolean
): PlatformSyncStatus {
  if (hasMetricValues && syncStatus === "partial") {
    return "synced";
  }

  if (
    !hasMetricValues &&
    API_METRICS_PLATFORMS.includes(platform as SocialPlatform)
  ) {
    return "pending_api";
  }

  return syncStatus;
}
