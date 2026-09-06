import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { creatorMatchesBrowseCategories } from "@/lib/creators/category-filter";
import { resolveCountryCode } from "@/lib/creators/country-code";
import {
  resolveCreatorCountryCodes,
} from "@/lib/creators/country-inference";
import {
  accumulateCreatorBrowseFillPage,
  isCreatorBrowseRawWindowExhausted,
} from "@/lib/creators/creator-browse-page-fill";
import type { UnifiedCreatorBrowseFilters, UnifiedCreatorResult } from "@/lib/creators/types";
import {
  audienceFilterFromSearchFields,
  hasAnyAudienceFilter,
  matchesAudienceFilter,
  type AgeGroupKey,
} from "@/features/discovery/enrichment/audience-filters";
import type { AudienceDemographics } from "@/features/discovery/enrichment/components/audience-demographics-section";

function normalizeCountryCode(value: string | null | undefined): string {
  // Resolve names/aliases → ISO-2 so audience-country matching agrees with the
  // SQL country_code filter (single shared resolver — no duplicate mapping).
  return resolveCountryCode(value);
}

function creatorCountryCodes(creator: UnifiedCreatorResult): string[] {
  return resolveCreatorCountryCodes({
    country_codes: creator.country_codes,
    country_code: creator.country_code,
    estimated_country: creator.estimated_country,
    platformAudienceCountries: creator.platforms.map((platform) => platform.audience_country),
  });
}
function matchesAudienceCountries(
  creator: UnifiedCreatorResult,
  audienceCountries: string[]
): boolean {
  if (audienceCountries.length === 0) return true;
  const targets = new Set(audienceCountries.map(normalizeCountryCode).filter(Boolean));
  if (targets.size === 0) return true;

  const demographics = creator.audience_demographics;
  if (demographics && demographics.source !== "unavailable") {
    for (const code of targets) {
      const filter = audienceFilterFromSearchFields({ audienceCountry: code });
      if (matchesAudienceFilter(demographics, filter)) return true;
    }
  }

  const platformMatch = creator.platforms.some((platform) =>
    targets.has(normalizeCountryCode(platform.audience_country))
  );
  if (platformMatch) return true;

  return creatorCountryCodes(creator).some((code) => targets.has(code));
}

function matchesAudienceInterestTags(
  creator: UnifiedCreatorResult,
  tags: string[]
): boolean {
  if (tags.length === 0) return true;
  const hay = [
    creator.ai_category,
    creator.ai_niche,
    ...(creator.audience_interests ?? []),
    ...creator.categories,
    ...(creator.browse_category_tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return tags.some((tag) => hay.includes(tag.trim().toLowerCase()));
}

/**
 * Phase 0 truth: when gender/age filters are active, missing demographic data
 * must NOT match. (Sparse passthrough in audience-filters.ts remains for scoring.)
 */
function matchesDemographicFilters(
  creator: UnifiedCreatorResult,
  filters: UnifiedCreatorBrowseFilters
): boolean {
  const demographicFilter = audienceFilterFromSearchFields({
    gender: filters.audienceGender,
    ageMin: filters.audienceAgeMin,
    ageMax: filters.audienceAgeMax,
  });
  if (!hasAnyAudienceFilter(demographicFilter)) return true;

  const demographics = creator.audience_demographics;
  if (!demographics) return false;

  if (demographicFilter.genderMinShare) {
    const share = demographics.gender[demographicFilter.genderMinShare.gender];
    if (share == null || share < demographicFilter.genderMinShare.min) {
      return false;
    }
  }

  if (demographicFilter.ageGroup) {
    const entries = Object.entries(demographics.age) as Array<[AgeGroupKey, number | null]>;
    let best: AgeGroupKey | null = null;
    let bestVal = -1;
    for (const [key, value] of entries) {
      if (value != null && value > bestVal) {
        bestVal = value;
        best = key;
      }
    }
    if (best == null || best !== demographicFilter.ageGroup) return false;
  }

  return true;
}

function matchesCreatorCountries(
  creator: UnifiedCreatorResult,
  countries: string[]
): boolean {
  if (countries.length === 0) return true;
  const targets = countries.map(normalizeCountryCode).filter(Boolean);
  if (targets.length === 0) return true;
  const creatorCodes = creatorCountryCodes(creator);
  return targets.some((code) => creatorCodes.includes(code));
}

/**
 * OR within the selected language group. Missing / empty language_codes do not
 * match when the user has selected languages (no invented language data).
 */
function matchesLanguageCodes(
  creator: UnifiedCreatorResult,
  languages: string[]
): boolean {
  if (languages.length === 0) return true;
  const codes = (creator.language_codes ?? [])
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
  if (codes.length === 0) return false;
  return languages.some((lang) => {
    const needle = lang.trim().toLowerCase();
    if (!needle) return false;
    return codes.some((code) => code === needle || code.includes(needle));
  });
}

/** True when creator avg views meets minViews; null views never qualify. */
export function creatorMatchesMinViews(
  creator: UnifiedCreatorResult,
  minViews: number | null | undefined
): boolean {
  if (minViews == null) return true;
  const views = creator.metrics?.avg_views?.value;
  if (views == null) return false;
  return views >= minViews;
}

/** True when Discovery UI audience / interest chips require post-hydration filtering. */
export function hasDiscoveryAudienceBrowseFilters(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return (
    (filters.audienceCountries?.length ?? 0) > 0 ||
    (filters.audienceInterestTags?.length ?? 0) > 0 ||
    Boolean(filters.audienceGender?.trim()) ||
    Boolean(filters.audienceAgeMin?.trim()) ||
    Boolean(filters.audienceAgeMax?.trim()) ||
    (filters.creatorCountries?.length ?? 0) > 1 ||
    (filters.languages?.length ?? 0) > 1 ||
    (filters.contentLanguages?.length ?? 0) > 0
  );
}

/**
 * Gender/age are enforced via conditional hydrate + post-filter on the normal
 * page path (Phase 0). Do not force the full-catalog audience scan for them —
 * sparse demographics would otherwise scan for tens of seconds and return empty.
 *
 * Phase 1A: multi creatorCountries are enforced at ID-stage OR (pool + candidate
 * qualification). Do not force the audience scan for creatorCountries alone.
 */
export function requiresDiscoveryAudienceScanPath(
  filters: UnifiedCreatorBrowseFilters
): boolean {
  return (
    (filters.audienceCountries?.length ?? 0) > 0 ||
    (filters.audienceInterestTags?.length ?? 0) > 0 ||
    (filters.languages?.length ?? 0) > 1 ||
    (filters.contentLanguages?.length ?? 0) > 0
  );
}

/** Pure predicate — shared by Discovery browse (server) and search workspace (client). */
export function creatorMatchesDiscoveryBrowseFilters(
  creator: UnifiedCreatorResult,
  filters: UnifiedCreatorBrowseFilters
): boolean {
  const categories = filters.categories ?? [];
  if (categories.length > 0 && !creatorMatchesBrowseCategories(creator, categories)) {
    return false;
  }

  const creatorCountries =
    filters.creatorCountries?.length
      ? filters.creatorCountries
      : filters.country
        ? [filters.country]
        : [];
  if (!matchesCreatorCountries(creator, creatorCountries)) return false;

  if (!matchesAudienceCountries(creator, filters.audienceCountries ?? [])) return false;
  if (!matchesAudienceInterestTags(creator, filters.audienceInterestTags ?? [])) return false;
  if (!matchesDemographicFilters(creator, filters)) return false;

  const languageFilters = [
    ...(filters.languages ?? []),
    ...(filters.language?.trim() ? [filters.language.trim()] : []),
  ];
  if (!matchesLanguageCodes(creator, languageFilters)) return false;
  if (!matchesLanguageCodes(creator, filters.contentLanguages ?? [])) return false;

  const platformFilterValues = [
    ...(filters.platform?.trim() ? [filters.platform.trim()] : []),
    ...(filters.platforms ?? []),
  ];
  if (platformFilterValues.length > 0) {
    const set = new Set(platformFilterValues.map((p) => canonicalPlatformKey(p)));
    if (!creator.platforms.some((p) => set.has(canonicalPlatformKey(p.platform)))) return false;
  }

  if (filters.minThinkwayScore != null && (creator.thinkway_score ?? 0) < filters.minThinkwayScore) {
    return false;
  }

  return true;
}

export function applyDiscoveryBrowseFilters(
  creators: UnifiedCreatorResult[],
  filters: UnifiedCreatorBrowseFilters
): UnifiedCreatorResult[] {
  if (!hasDiscoveryAudienceBrowseFilters(filters)) {
    const categories = filters.categories ?? [];
    if (
      categories.length === 0 &&
      !filters.country &&
      !filters.platform?.trim() &&
      !filters.platforms?.length
    ) {
      return creators;
    }
  }
  return creators.filter((creator) => creatorMatchesDiscoveryBrowseFilters(creator, filters));
}

/**
 * Audience-scan raw-pool exhaustion.
 *
 * MUST use the pre-qualification candidate ID count from the pool page.
 * NEVER use qualified / hydrated / post-filtered batch length — Phase 1A
 * qualification can shrink a full pool page without exhausting the pool.
 */
export function isDiscoveryAudienceRawPoolExhausted(
  rawCandidateCount: number,
  batchSize: number
): boolean {
  return isCreatorBrowseRawWindowExhausted({ rawCandidateCount, batchSize });
}

export type DiscoveryAudienceScanBatch<T extends { unified_id: string }> = {
  /** Creators after hydrate (may already be Phase-1A-qualified). */
  creators: T[];
  /** Pool IDs / discovery rows retrieved BEFORE Phase 1A qualification. */
  rawCandidateCount: number;
};

export type DiscoveryAudienceScanPageResult<T extends { unified_id: string }> = {
  creators: T[];
  total: number;
  has_more: boolean;
};

/**
 * Audience-scan page fill — thin adapter over the shared Phase 1B-1 primitive.
 */
export async function accumulateDiscoveryAudienceScanPage<
  T extends { unified_id: string },
>(options: {
  page: number;
  pageSize: number;
  batchSize: number;
  maxBatchPages: number;
  fetchBatch: (batchPage: number) => Promise<DiscoveryAudienceScanBatch<T>>;
  applyFilters: (creators: T[]) => T[];
  sort: (creators: T[]) => T[];
}): Promise<DiscoveryAudienceScanPageResult<T>> {
  const result = await accumulateCreatorBrowseFillPage({
    page: options.page,
    pageSize: options.pageSize,
    batchSize: options.batchSize,
    maxWindows: options.maxBatchPages,
    fetchWindow: options.fetchBatch,
    applyFilters: options.applyFilters,
    sort: options.sort,
  });
  return {
    creators: result.creators,
    total: result.total,
    has_more: result.has_more,
  };
}

export type { AudienceDemographics };
