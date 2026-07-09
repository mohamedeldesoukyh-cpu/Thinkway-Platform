import type { UnifiedCreatorResult } from "@/lib/creators/types";

import type { CreatorEnrichmentStatus } from "./types";

const MEANINGFUL_FIELD_SUFFIXES = [
  "follower_count",
  "engagement_rate",
  "avg_views",
  "avg_likes",
  "avg_comments",
  "profile_bio",
  "profile_picture_url",
] as const;

/** True when enrichment touched metrics or profile fields users expect in Discovery. */
export function enrichmentUpdatedMeaningfulFields(fieldPaths: string[]): boolean {
  return fieldPaths.some((field) =>
    MEANINGFUL_FIELD_SUFFIXES.some((suffix) => field.endsWith(`.${suffix}`) || field === suffix)
  );
}

export function creatorHasDisplayableMetrics(
  creator: Pick<UnifiedCreatorResult, "metrics" | "platforms">
): boolean {
  if ((creator.metrics.followers.value ?? 0) > 0) return true;
  return creator.platforms.some(
    (platform) => (platform.follower_count ?? 0) > 0 || platform.engagement_rate != null
  );
}

/**
 * Badge status reconciled with actual row data — avoids "Updated" when nothing was pulled.
 */
export function resolveEnrichmentDisplayStatus(
  status: CreatorEnrichmentStatus | null | undefined,
  creator: Pick<UnifiedCreatorResult, "metrics" | "platforms">
): CreatorEnrichmentStatus {
  const resolved = status ?? "never";
  if (creatorHasDisplayableMetrics(creator)) return resolved;

  if (resolved === "enriched" || resolved === "skipped") {
    return "never";
  }

  return resolved;
}
