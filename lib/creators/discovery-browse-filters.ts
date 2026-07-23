import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { creatorMatchesBrowseCategories } from "@/lib/creators/category-filter";
import { resolveCountryCode } from "@/lib/creators/country-code";
import {
  resolveCreatorCountryCodes,
} from "@/lib/creators/country-inference";
import type { UnifiedCreatorBrowseFilters, UnifiedCreatorResult } from "@/lib/creators/types";import {
  audienceFilterFromSearchFields,
  hasAnyAudienceFilter,
  matchesAudienceFilter,
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
  if (!demographics) return true;
  return matchesAudienceFilter(demographics, demographicFilter);
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

function matchesLanguageCodes(
  creator: UnifiedCreatorResult,
  languages: string[]
): boolean {
  if (languages.length === 0) return true;
  const codes = creator.language_codes.map((code) => code.trim().toLowerCase()).filter(Boolean);
  if (codes.length === 0) return false;
  return languages.some((lang) => {
    const needle = lang.trim().toLowerCase();
    return codes.some((code) => code === needle || code.includes(needle));
  });
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

export type { AudienceDemographics };
