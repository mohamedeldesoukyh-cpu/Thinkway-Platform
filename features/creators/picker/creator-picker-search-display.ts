import { filterExactCreatorMatches } from "@/features/discovery/components/creator-search/creator-search-exact-match";
import { scoreCreatorSearchIntent } from "@/features/discovery/components/creator-search/creator-search-intent-engine";
import { buildDiscoverySearchTaxonomyIndex } from "@/features/discovery/components/creator-search/creator-search-taxonomy";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

const PICKER_SEARCH_TAXONOMY = buildDiscoverySearchTaxonomyIndex([]);

export type CreatorPickerSearchDisplay = {
  creators: UnifiedCreatorResult[];
  total: number;
  isExactCreatorSearch: boolean;
  exactCreatorZeroMatch: boolean;
};

/**
 * Align shortlist/campaign picker search with Discovery Search: handle-like queries
 * only show exact handle/name matches; zero exact hits → "Add missing creator".
 */
export function resolveCreatorPickerSearchDisplay(
  searchQuery: string,
  creators: UnifiedCreatorResult[],
  options?: { loading?: boolean; browseTotal?: number }
): CreatorPickerSearchDisplay {
  const trimmed = searchQuery.trim();
  if (!trimmed) {
    return {
      creators,
      total: options?.browseTotal ?? creators.length,
      isExactCreatorSearch: false,
      exactCreatorZeroMatch: false,
    };
  }

  const intent = scoreCreatorSearchIntent(trimmed, PICKER_SEARCH_TAXONOMY);
  const isExactCreatorSearch = intent.mode === "exact";

  if (!isExactCreatorSearch) {
    return {
      creators,
      total: options?.browseTotal ?? creators.length,
      isExactCreatorSearch: false,
      exactCreatorZeroMatch: false,
    };
  }

  const exactMatches = filterExactCreatorMatches(creators, trimmed);
  const exactCreatorZeroMatch = !options?.loading && exactMatches.length === 0;

  return {
    creators: exactMatches,
    total: exactMatches.length,
    isExactCreatorSearch: true,
    exactCreatorZeroMatch,
  };
}
