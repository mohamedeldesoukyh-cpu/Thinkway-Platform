import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  applyDiscoveryBrowseFilters,
  creatorMatchesDiscoveryBrowseFilters,
} from "@/lib/creators/discovery-browse-filters";
import { creatorMatchesLastPostWithin } from "@/lib/creators/creator-last-post-filter";
import { listClientOnlyCreatorSearchFilterKeys } from "@/lib/creators/creator-search-filter-truth";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import type { CreatorSearchFilters } from "./creator-search-types";
import { filtersToBrowseParams } from "./creator-search-types";

function creatorSearchFiltersToBrowseFilters(
  filters: CreatorSearchFilters
): UnifiedCreatorBrowseFilters {
  return filtersToBrowseParams(filters, 1, 1);
}

/**
 * Filters still applied only in the browser after Phase 0.
 * Language / last-post / demographics / minViews moved server-side.
 */
export function hasClientOnlyCreatorSearchFilters(filters: CreatorSearchFilters): boolean {
  return listClientOnlyCreatorSearchFilterKeys(filters).length > 0;
}

export function applyCreatorSearchClientFilters(
  creators: UnifiedCreatorResult[],
  filters: CreatorSearchFilters
): UnifiedCreatorResult[] {
  const browseFilters = creatorSearchFiltersToBrowseFilters(filters);
  let results = applyDiscoveryBrowseFilters(creators, browseFilters);

  // Defense in depth — server already applies lastPostWithin when hydrated.
  results = results.filter((creator) =>
    creatorMatchesLastPostWithin(creator, filters.lastPostWithin)
  );

  return results.filter((creator) => {
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
