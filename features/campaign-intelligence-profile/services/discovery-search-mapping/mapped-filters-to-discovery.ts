import type { CreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import {
  cloneCreatorSearchFilters,
  DEFAULT_CREATOR_SEARCH_FILTERS,
  filtersToBrowseParams,
} from "@/features/discovery/components/creator-search/creator-search-types";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

import type { CampaignSearchCriterion } from "../../types/profile";
import type { DiscoveryMappedFilter } from "./types";
import { formatDiscoveryMappedFilterValue } from "./map-campaign-intelligence";

/** Map canonical Discovery filters → CreatorSearchFilters for the browse engine. */
export function discoveryMappedFiltersToCreatorFilters(
  mapped: DiscoveryMappedFilter[]
): CreatorSearchFilters {
  const filters: CreatorSearchFilters = {
    ...cloneCreatorSearchFilters(DEFAULT_CREATOR_SEARCH_FILTERS),
    search: "",
    contentKeyword: "",
  };

  for (const item of mapped) {
    switch (item.key) {
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
      case "creator_country":
        if (!filters.countries.includes(item.value)) {
          filters.countries.push(item.value);
        }
        break;
      case "creator_city":
        if (!filters.countries.includes(item.value)) {
          filters.countries.push(item.value);
        }
        break;
      case "audience_country":
        if (!filters.audienceCountries.includes(item.value)) {
          filters.audienceCountries.push(item.value);
        }
        break;
      case "audience_city":
        if (!filters.audienceCountries.includes(item.value)) {
          filters.audienceCountries.push(item.value);
        }
        break;
      case "creator_gender":
      case "audience_gender":
        if (!filters.gender) filters.gender = item.value.toLowerCase();
        break;
      case "creator_age_min":
      case "audience_age_min":
        if (!filters.ageMin) filters.ageMin = item.value;
        break;
      case "creator_age_max":
      case "audience_age_max":
        if (!filters.ageMax) filters.ageMax = item.value;
        break;
      case "language":
        if (!filters.languages.includes(item.value)) {
          filters.languages.push(item.value);
        }
        break;
      case "platform": {
        const platform = item.value.toLowerCase();
        if (!filters.platforms.includes(platform)) filters.platforms.push(platform);
        break;
      }
      case "follower_min":
        if (!filters.minFollowers) filters.minFollowers = item.value;
        break;
      case "follower_max":
        if (!filters.maxFollowers) filters.maxFollowers = item.value;
        break;
      case "engagement_min":
        if (!filters.minEngagement) filters.minEngagement = item.value;
        break;
      case "engagement_max":
        break;
      case "content_keyword":
        if (!filters.contentKeyword) filters.contentKeyword = item.value;
        break;
      case "content_tag":
        if (!filters.contentTags.includes(item.value)) {
          filters.contentTags.push(item.value);
        }
        break;
      case "brand_safety_min":
        if (!filters.minBrandSafety) filters.minBrandSafety = item.value;
        break;
      case "brand_fit_min":
        if (!filters.minBrandFit) filters.minBrandFit = item.value;
        break;
      case "verified":
        break;
      default:
        break;
    }
  }

  return filters;
}

export function discoveryMappedFiltersToBrowseFilters(
  mapped: DiscoveryMappedFilter[],
  page = 1,
  pageSize = 50
): UnifiedCreatorBrowseFilters {
  return filtersToBrowseParams(discoveryMappedFiltersToCreatorFilters(mapped), page, pageSize);
}

const KEY_TO_CRITERION_KIND: Partial<
  Record<DiscoveryMappedFilter["key"], CampaignSearchCriterion["kind"]>
> = {
  category: "category",
  niche: "niche",
  creator_country: "country",
  audience_country: "country",
  audience_city: "city",
  creator_gender: "audience",
  audience_gender: "audience",
  creator_age_min: "audience",
  creator_age_max: "audience",
  audience_age_min: "audience",
  audience_age_max: "audience",
  language: "language",
  platform: "platform",
  brand_safety_min: "brand_fit",
  brand_fit_min: "luxury",
  engagement_min: "engagement",
  content_tag: "niche",
};

/** UI chip view model — only mapped Discovery filters, never raw CIP fields. */
export function discoveryMappedFiltersToCriteria(
  mapped: DiscoveryMappedFilter[]
): CampaignSearchCriterion[] {
  return mapped.map((item) => ({
    id: item.id,
    kind: KEY_TO_CRITERION_KIND[item.key] ?? "category",
    label: item.label,
    value: formatDiscoveryMappedFilterValue(item),
    weight: item.weight,
    enabled: true,
    meta: { discoveryKey: item.key, rawValue: item.value },
  }));
}
