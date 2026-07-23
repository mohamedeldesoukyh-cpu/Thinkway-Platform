import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import { isPositiveNumericMetric } from "./creator-display-utils";
import type { UnifiedCreatorPlatform } from "./types";

function platformHasDisplayableMetrics(platform: UnifiedCreatorPlatform): boolean {
  return (
    isPositiveNumericMetric(platform.follower_count) ||
    platform.engagement_rate != null ||
    isPositiveNumericMetric(platform.avg_views)
  );
}

function isEnrichmentNotConfiguredError(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return /actor id not configured|not configured|APIFY_TOKEN not configured/i.test(message);
}

/** Short label when a platform row has no followers / ER / avg views to show. */
export function resolvePlatformMetricsEmptyHint(
  platform: UnifiedCreatorPlatform
): string | null {
  if (platformHasDisplayableMetrics(platform)) return null;

  const platformKey = canonicalPlatformKey(platform.platform);
  const status = platform.enrichment_status ?? "never";
  const syncError = platform.sync_error?.trim() ?? "";

  if (status === "running" || status === "queued") {
    return "Enriching…";
  }

  if (isEnrichmentNotConfiguredError(syncError)) {
    return platformKey === "snapchat"
      ? "Snapchat enrichment not configured"
      : "Enrichment not configured";
  }

  if (status === "failed" || platform.sync_status === "failed") {
    return platformKey === "snapchat" ? "Snapchat enrichment failed" : "Enrichment failed";
  }

  if (status === "never" && platformKey === "snapchat") {
    return "Snapchat not enriched yet";
  }

  if (platformKey === "snapchat") {
    return "No Snapchat metrics";
  }

  return null;
}
