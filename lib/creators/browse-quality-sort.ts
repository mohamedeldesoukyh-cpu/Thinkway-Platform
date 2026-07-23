import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { compareEnrichmentSortRank } from "@/lib/creators/enrichment-sort-rank";

type PlatformCountable = Partial<Pick<UnifiedCreatorResult, "platforms">>;

/** Distinct linked platforms on a creator profile. */
export function countCreatorPlatforms(creator: PlatformCountable): number {
  const seen = new Set<string>();
  for (const platform of creator.platforms ?? []) {
    const key = platform.platform?.trim().toLowerCase();
    if (key) seen.add(key);
  }
  return seen.size;
}

/** More platforms rank higher (negative = `a` before `b`). */
export function compareMultiPlatformCount(a: PlatformCountable, b: PlatformCountable): number {
  return countCreatorPlatforms(b) - countCreatorPlatforms(a);
}

type BrowseQualityFields = Pick<
  UnifiedCreatorResult,
  "enrichment_status" | "last_enriched_at" | "updated_at" | "platforms"
>;

/**
 * Browse quality tie-break — full enrichment data first, then multi-platform profiles.
 * Used after recency (or as a pin group before user-selected sort fields).
 */
export function compareBrowseQualityRank(a: BrowseQualityFields, b: BrowseQualityFields): number {
  return compareEnrichmentSortRank(a, b) || compareMultiPlatformCount(a, b);
}
