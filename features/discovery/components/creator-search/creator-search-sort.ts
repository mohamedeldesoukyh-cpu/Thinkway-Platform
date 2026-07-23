import { resolveDiscoveryCreatorDisplayCategories } from "@/lib/creators/creator-display-categories";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { compareBrowseDefaultOrder } from "@/lib/creators/browse-pin-tier";
import { compareBrowseQualityRank } from "@/lib/creators/browse-quality-sort";
import { resolveCreatorDiscoverySource } from "@/features/discovery/components/creator-search/creator-discovery-source";

import {
  defaultDirectionForSortField,
  type CreatorSearchSortField,
  type CreatorSearchSortState,
} from "./creator-search-types";

function thinkwayAiScore(creator: UnifiedCreatorResult): number | null {
  return creator.thinkway_score ?? creator.brand_fit_score ?? null;
}

function compareQualityFirst(a: UnifiedCreatorResult, b: UnifiedCreatorResult): number {
  return compareBrowseQualityRank(a, b);
}

function resolveSortFollowers(creator: UnifiedCreatorResult): number {
  return (
    creator.metrics.followers.value ??
    creator.platforms[0]?.follower_count ??
    0
  );
}

function resolveSortEngagement(creator: UnifiedCreatorResult): number {
  return (
    creator.metrics.engagement_rate.value ??
    creator.platforms[0]?.engagement_rate ??
    0
  );
}

function resolveSortViews(creator: UnifiedCreatorResult): number {
  return creator.metrics.avg_views.value ?? creator.platforms[0]?.avg_views ?? 0;
}

function resolveSortRelevance(creator: UnifiedCreatorResult): number {
  return creator.campaign_relevance_score ?? 0;
}

function resolveSortPlatform(creator: UnifiedCreatorResult): string {
  return [...creator.platforms]
    .map((platform) => platform.platform.trim().toLowerCase())
    .sort()
    .join(", ");
}

function resolveSortCountry(creator: UnifiedCreatorResult): string {
  const codes = resolveCreatorCountryCodes({
    country_codes: creator.country_codes,
    country_code: creator.country_code,
    estimated_country: creator.estimated_country,
    platformAudienceCountries: creator.platforms.map((platform) => platform.audience_country),
  });
  return codes.join(",");
}

function resolveSortCategories(creator: UnifiedCreatorResult): string {
  const parts = resolveDiscoveryCreatorDisplayCategories(creator);
  return parts.length > 0 ? parts.join(", ").toLowerCase() : "";
}

function resolveSortBrandSafety(creator: UnifiedCreatorResult): number {
  return creator.authenticity_score ?? -1;
}

function resolveSortSource(creator: UnifiedCreatorResult): string {
  return resolveCreatorDiscoverySource(creator);
}

const NUMERIC_SORT_VALUE: Record<
  Extract<
    CreatorSearchSortField,
    | "relevance"
    | "followers"
    | "engagement"
    | "views"
    | "thinkway"
    | "brand_safety"
  >,
  (creator: UnifiedCreatorResult) => number
> = {
  relevance: resolveSortRelevance,
  followers: resolveSortFollowers,
  engagement: resolveSortEngagement,
  views: resolveSortViews,
  thinkway: (creator) => thinkwayAiScore(creator) ?? 0,
  brand_safety: resolveSortBrandSafety,
};

const STRING_SORT_VALUE: Record<
  Extract<CreatorSearchSortField, "platform" | "country" | "categories" | "source">,
  (creator: UnifiedCreatorResult) => string
> = {
  platform: resolveSortPlatform,
  country: resolveSortCountry,
  categories: resolveSortCategories,
  source: resolveSortSource,
};

function compareWithDirection(
  left: number,
  right: number,
  direction: CreatorSearchSortState["direction"]
): number {
  const delta = left - right;
  return direction === "asc" ? delta : -delta;
}

function compareStringsWithDirection(
  left: string,
  right: string,
  direction: CreatorSearchSortState["direction"]
): number {
  const cmp = left.localeCompare(right, undefined, { sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

function stableNameTiebreak(
  a: UnifiedCreatorResult,
  b: UnifiedCreatorResult,
  direction: CreatorSearchSortState["direction"]
): number {
  const cmp = a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" });
  return direction === "asc" ? cmp : -cmp;
}

/** Toggle or set sort when a table column header is clicked. */
export function applyCreatorSearchHeaderSort(
  current: CreatorSearchSortState,
  field: CreatorSearchSortField
): CreatorSearchSortState {
  if (current.field === field) {
    return {
      field,
      direction: current.direction === "asc" ? "desc" : "asc",
    };
  }
  return { field, direction: defaultDirectionForSortField(field) };
}

/** Stable client-side sort over the full loaded result set. */
export function sortCreators(
  creators: UnifiedCreatorResult[],
  sort: CreatorSearchSortState,
  nowMs: number = Date.now()
): UnifiedCreatorResult[] {
  const next = [...creators];

  if (sort.field === "name") {
    next.sort((a, b) => {
      const enrichment = compareQualityFirst(a, b);
      if (enrichment !== 0) return enrichment;
      const cmp = a.display_name.localeCompare(b.display_name, undefined, {
        sensitivity: "base",
      });
      const primary = sort.direction === "asc" ? cmp : -cmp;
      return primary !== 0 ? primary : stableNameTiebreak(a, b, sort.direction);
    });
    return next;
  }

  if (sort.field === "last_synced") {
    next.sort((a, b) => {
      const ordered = compareBrowseDefaultOrder(a, b, sort.direction, nowMs);
      return ordered !== 0 ? ordered : stableNameTiebreak(a, b, sort.direction);
    });
    return next;
  }

  if (sort.field in STRING_SORT_VALUE) {
    const getValue = STRING_SORT_VALUE[sort.field as keyof typeof STRING_SORT_VALUE];
    next.sort((a, b) => {
      const enrichment = compareQualityFirst(a, b);
      if (enrichment !== 0) return enrichment;
      const primary = compareStringsWithDirection(getValue(a), getValue(b), sort.direction);
      return primary !== 0 ? primary : stableNameTiebreak(a, b, sort.direction);
    });
    return next;
  }

  const getValue = NUMERIC_SORT_VALUE[sort.field as keyof typeof NUMERIC_SORT_VALUE];
  next.sort((a, b) => {
    const enrichment = compareQualityFirst(a, b);
    if (enrichment !== 0) return enrichment;
    const primary = compareWithDirection(getValue(a), getValue(b), sort.direction);
    return primary !== 0 ? primary : stableNameTiebreak(a, b, sort.direction);
  });
  return next;
}

export { thinkwayAiScore, resolveSortFollowers, resolveSortEngagement };
