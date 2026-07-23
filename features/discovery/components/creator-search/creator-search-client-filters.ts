import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  applyDiscoveryBrowseFilters,
  creatorMatchesDiscoveryBrowseFilters,
} from "@/lib/creators/discovery-browse-filters";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import type { CreatorSearchFilters } from "./creator-search-types";
import { filtersToBrowseParams } from "./creator-search-types";

const LAST_POST_DAYS: Record<string, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

function latestPublicationTimestamp(creator: UnifiedCreatorResult): number | null {
  const timestamps: number[] = [];
  const pushDate = (value: string | null | undefined) => {
    if (!value) return;
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) timestamps.push(parsed);
  };

  for (const publication of creator.recent_publications ?? []) {
    pushDate(publication.posted_at);
  }
  for (const platform of creator.platforms) {
    for (const publication of platform.recent_publications ?? []) {
      pushDate(publication.posted_at);
    }
  }
  pushDate(creator.last_enriched_at);

  if (timestamps.length === 0) return null;
  return Math.max(...timestamps);
}

function matchesLastPostWithin(creator: UnifiedCreatorResult, within: string): boolean {
  const days = LAST_POST_DAYS[within];
  if (!days) return true;
  const latest = latestPublicationTimestamp(creator);
  if (latest == null) return true;
  return latest >= Date.now() - days * 86_400_000;
}

function creatorSearchFiltersToBrowseFilters(
  filters: CreatorSearchFilters
): UnifiedCreatorBrowseFilters {
  return filtersToBrowseParams(filters, 1, 1);
}

/** Filters applied only in the browser (not sent to unified browse). */
export function hasClientOnlyCreatorSearchFilters(filters: CreatorSearchFilters): boolean {
  return Boolean(
    filters.lastPostWithin ||
      filters.aiNiche.trim() ||
      filters.minBrandSafety.trim() ||
      filters.handle.trim() ||
      filters.languages.length > 1 ||
      filters.contentLanguages.length > 0
  );
}

export function applyCreatorSearchClientFilters(
  creators: UnifiedCreatorResult[],
  filters: CreatorSearchFilters
): UnifiedCreatorResult[] {
  const browseFilters = creatorSearchFiltersToBrowseFilters(filters);
  let results = applyDiscoveryBrowseFilters(creators, browseFilters);

  return results.filter((creator) => {
    if (!matchesLastPostWithin(creator, filters.lastPostWithin)) return false;

    if (filters.aiNiche.trim()) {
      const needle = filters.aiNiche.trim().toLowerCase();
      const niche = (creator.ai_niche ?? "").toLowerCase();
      if (!niche.includes(needle)) return false;
    }

    if (filters.minBrandSafety.trim()) {
      const min = Number(filters.minBrandSafety);
      const score = creator.authenticity_score ?? creator.brand_fit_score ?? 0;
      if (score < min) return false;
    }

    if (filters.handle.trim()) {
      const needle = filters.handle.trim().toLowerCase().replace(/^@/, "");
      const handle = creator.platforms[0]?.handle?.toLowerCase() ?? "";
      if (!handle.includes(needle)) return false;
    }

    return true;
  });
}

export { creatorMatchesDiscoveryBrowseFilters };
