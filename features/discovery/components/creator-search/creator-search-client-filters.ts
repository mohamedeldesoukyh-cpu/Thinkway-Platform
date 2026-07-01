import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { creatorMatchesBrowseCategories } from "@/lib/creators/category-filter";

import type { CreatorSearchFilters } from "./creator-search-types";

export function applyCreatorSearchClientFilters(
  creators: UnifiedCreatorResult[],
  filters: CreatorSearchFilters
): UnifiedCreatorResult[] {
  return creators.filter((creator) => {
    if (filters.categories.length > 0) {
      if (!creatorMatchesBrowseCategories(creator, filters.categories)) return false;
    }
    if (filters.platforms.length > 1) {
      const hasPlatform = creator.platforms.some((p) =>
        filters.platforms.includes(p.platform)
      );
      if (!hasPlatform) return false;
    }

    if (filters.audienceCountry.trim()) {
      const ac = filters.audienceCountry.trim().toUpperCase();
      const match = creator.platforms.some(
        (p) => (p.audience_country ?? creator.country_code ?? "").toUpperCase() === ac
      );
      if (!match) return false;
    }

    if (filters.audienceInterests.trim()) {
      const needle = filters.audienceInterests.trim().toLowerCase();
      const hay = [
        creator.ai_category,
        creator.ai_niche,
        ...creator.categories,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(needle)) return false;
    }

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

    if (filters.minThinkwayScore.trim()) {
      const min = Number(filters.minThinkwayScore);
      if ((creator.thinkway_score ?? 0) < min) return false;
    }

    if (filters.handle.trim()) {
      const needle = filters.handle.trim().toLowerCase().replace(/^@/, "");
      const handle = creator.platforms[0]?.handle?.toLowerCase() ?? "";
      if (!handle.includes(needle)) return false;
    }

    return true;
  });
}
