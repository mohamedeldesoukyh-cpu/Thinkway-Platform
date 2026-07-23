import type { CreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import {
  cloneCreatorSearchFilters,
  DEFAULT_CREATOR_SEARCH_FILTERS,
  filtersToBrowseParams,
} from "@/features/discovery/components/creator-search/creator-search-types";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import type { CampaignSearchCriterion } from "../types/profile";

function normalizePlatform(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.includes("instagram") || v === "ig") return "instagram";
  if (v.includes("tiktok") || v === "tt") return "tiktok";
  if (v.includes("youtube") || v === "yt") return "youtube";
  if (v.includes("twitter") || v === "x") return "twitter";
  return v;
}

/**
 * @deprecated Use `buildCreatorFiltersFromProfile` — criteria values are display labels
 * (e.g. country codes become "Egypt") and corrupt browse params when round-tripped.
 */
export function searchStrategyToCreatorFilters(
  criteria: CampaignSearchCriterion[]
): CreatorSearchFilters {
  const filters: CreatorSearchFilters = {
    ...cloneCreatorSearchFilters(DEFAULT_CREATOR_SEARCH_FILTERS),
    search: "",
    contentKeyword: "",
  };

  const enabled = criteria.filter((c) => c.enabled && c.value.trim());

  for (const item of enabled) {
    switch (item.kind) {
      case "category":
        if (!filters.categories.includes(item.value)) {
          filters.categories.push(item.value);
        }
        break;
      case "niche":
        if (!filters.audienceInterestTags.includes(item.value)) {
          filters.audienceInterestTags.push(item.value);
        }
        if (!filters.aiNiche) filters.aiNiche = item.value;
        break;
      case "country":
        if (!filters.countries.includes(item.value)) {
          filters.countries.push(item.value);
        }
        break;
      case "city":
        if (!filters.audienceCountries.includes(item.value)) {
          filters.audienceCountries.push(item.value);
        }
        break;
      case "audience":
        if (item.meta?.gender && typeof item.meta.gender === "string") {
          filters.gender = item.meta.gender.toLowerCase();
        }
        if (item.meta?.ageMin != null) filters.ageMin = String(item.meta.ageMin);
        if (item.meta?.ageMax != null) filters.ageMax = String(item.meta.ageMax);
        if (!filters.audienceInterestTags.includes(item.value)) {
          filters.audienceInterestTags.push(item.value);
        }
        break;
      case "platform": {
        const platform = normalizePlatform(item.value);
        if (!filters.platforms.includes(platform)) filters.platforms.push(platform);
        break;
      }
      case "language":
        if (!filters.languages.includes(item.value)) {
          filters.languages.push(item.value);
        }
        break;
      case "luxury":
        filters.minBrandFit = filters.minBrandFit || "70";
        break;
      case "brand_fit":
        filters.minBrandSafety = filters.minBrandSafety || "70";
        filters.minBrandFit = filters.minBrandFit || "65";
        break;
      case "authenticity":
        filters.minThinkwayScore = filters.minThinkwayScore || "60";
        break;
      case "engagement":
        filters.minEngagement = filters.minEngagement || "2";
        break;
      default:
        break;
    }
  }

  return filters;
}

export function searchStrategyToBrowseFilters(
  criteria: CampaignSearchCriterion[],
  page = 1,
  pageSize = 50
): UnifiedCreatorBrowseFilters {
  const creatorFilters = searchStrategyToCreatorFilters(criteria);
  return filtersToBrowseParams(creatorFilters, page, pageSize);
}
