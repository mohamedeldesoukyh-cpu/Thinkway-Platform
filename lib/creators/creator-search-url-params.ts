import {
  applyCategoriesToUrlParams,
  categoriesEqual,
  categoriesFromUrlParams,
  CREATOR_SEARCH_QUERY_PARAM,
} from "@/lib/creators/category-filter";
import { resolveCountryCode } from "@/lib/creators/country-code";
import {
  cloneCreatorSearchFilters,
  type CreatorSearchFilters,
} from "@/features/discovery/components/creator-search/creator-search-types";

type UrlReader = {
  get: (name: string) => string | null;
  getAll: (name: string) => string[];
};

/** Repeated URL keys for multi-select creator search filters. */
export const CREATOR_SEARCH_COUNTRY_PARAM = "country";
export const CREATOR_SEARCH_PLATFORM_PARAM = "platform";
export const CREATOR_SEARCH_AUDIENCE_COUNTRY_PARAM = "audienceCountry";
export const CREATOR_SEARCH_AUDIENCE_INTEREST_PARAM = "audienceInterest";
export const CREATOR_SEARCH_CONTENT_TAG_PARAM = "tag";

/** Scalar URL keys for creator search filters. */
export const CREATOR_SEARCH_HANDLE_PARAM = "handle";
export const CREATOR_SEARCH_LANGUAGE_PARAM = "lang";
export const CREATOR_SEARCH_CONTENT_LANGUAGE_PARAM = "contentLang";
export const CREATOR_SEARCH_CONTENT_KEYWORD_PARAM = "keyword";
export const CREATOR_SEARCH_LAST_POST_PARAM = "lastPost";
export const CREATOR_SEARCH_GENDER_PARAM = "gender";
export const CREATOR_SEARCH_AGE_MIN_PARAM = "ageMin";
export const CREATOR_SEARCH_AGE_MAX_PARAM = "ageMax";
export const CREATOR_SEARCH_MIN_FOLLOWERS_PARAM = "minFollowers";
export const CREATOR_SEARCH_MAX_FOLLOWERS_PARAM = "maxFollowers";
export const CREATOR_SEARCH_MIN_ENGAGEMENT_PARAM = "minEngagement";
export const CREATOR_SEARCH_MIN_VIEWS_PARAM = "minViews";
export const CREATOR_SEARCH_MIN_COST_PARAM = "minCost";
export const CREATOR_SEARCH_MAX_COST_PARAM = "maxCost";
export const CREATOR_SEARCH_MIN_BRAND_SAFETY_PARAM = "minBrandSafety";
export const CREATOR_SEARCH_AI_NICHE_PARAM = "niche";
export const CREATOR_SEARCH_MIN_THINKWAY_PARAM = "minThinkway";
export const CREATOR_SEARCH_MIN_BRAND_FIT_PARAM = "minBrandFit";
export const CREATOR_SEARCH_MIN_AI_SCORE_PARAM = "minAi";
export const CREATOR_SEARCH_ADVANCED_PARAM = "advanced";

const FILTER_MANAGED_PARAMS = [
  CREATOR_SEARCH_COUNTRY_PARAM,
  CREATOR_SEARCH_PLATFORM_PARAM,
  CREATOR_SEARCH_AUDIENCE_COUNTRY_PARAM,
  CREATOR_SEARCH_AUDIENCE_INTEREST_PARAM,
  CREATOR_SEARCH_CONTENT_TAG_PARAM,
  CREATOR_SEARCH_HANDLE_PARAM,
  CREATOR_SEARCH_LANGUAGE_PARAM,
  CREATOR_SEARCH_CONTENT_LANGUAGE_PARAM,
  CREATOR_SEARCH_CONTENT_KEYWORD_PARAM,
  CREATOR_SEARCH_LAST_POST_PARAM,
  CREATOR_SEARCH_GENDER_PARAM,
  CREATOR_SEARCH_AGE_MIN_PARAM,
  CREATOR_SEARCH_AGE_MAX_PARAM,
  CREATOR_SEARCH_MIN_FOLLOWERS_PARAM,
  CREATOR_SEARCH_MAX_FOLLOWERS_PARAM,
  CREATOR_SEARCH_MIN_ENGAGEMENT_PARAM,
  CREATOR_SEARCH_MIN_VIEWS_PARAM,
  CREATOR_SEARCH_MIN_COST_PARAM,
  CREATOR_SEARCH_MAX_COST_PARAM,
  CREATOR_SEARCH_MIN_BRAND_SAFETY_PARAM,
  CREATOR_SEARCH_AI_NICHE_PARAM,
  CREATOR_SEARCH_MIN_THINKWAY_PARAM,
  CREATOR_SEARCH_MIN_BRAND_FIT_PARAM,
  CREATOR_SEARCH_MIN_AI_SCORE_PARAM,
  CREATOR_SEARCH_ADVANCED_PARAM,
] as const;

function trimParam(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function stringArrayFromParams(source: UrlReader, param: string): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const raw of source.getAll(param)) {
    const value = trimParam(raw);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

function countryCodesFromParams(source: UrlReader, param: string): string[] {
  return stringArrayFromParams(source, param)
    .map((code) => resolveCountryCode(code))
    .filter(Boolean);
}

function applyStringArrayToParams(
  params: URLSearchParams,
  param: string,
  values: string[]
): void {
  params.delete(param);
  for (const value of values) {
    const trimmed = trimParam(value);
    if (!trimmed) continue;
    params.append(param, trimmed);
  }
}

function applyCountryCodesToParams(
  params: URLSearchParams,
  param: string,
  values: string[]
): void {
  applyStringArrayToParams(
    params,
    param,
    values.map((code) => code.trim().toUpperCase()).filter(Boolean)
  );
}

function scalarFromParams(source: UrlReader, param: string): string {
  return trimParam(source.get(param));
}

function applyScalarToParams(
  params: URLSearchParams,
  param: string,
  value: string
): void {
  params.delete(param);
  const trimmed = trimParam(value);
  if (trimmed) params.set(param, trimmed);
}

function booleanFromParams(source: UrlReader, param: string): boolean {
  const value = trimParam(source.get(param)).toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function applyBooleanToParams(
  params: URLSearchParams,
  param: string,
  value: boolean
): void {
  params.delete(param);
  if (value) params.set(param, "1");
}

function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function languagesFromParams(source: UrlReader): string[] {
  const repeated = stringArrayFromParams(source, CREATOR_SEARCH_LANGUAGE_PARAM).map((code) =>
    code.trim().toLowerCase()
  );
  if (repeated.length > 0) return repeated;
  const legacy = scalarFromParams(source, CREATOR_SEARCH_LANGUAGE_PARAM);
  return legacy ? [legacy.toLowerCase()] : [];
}

/** Read creator search filters from URL params (excludes top-bar `q` search). */
export function filtersFromUrlParams(source: UrlReader): Partial<CreatorSearchFilters> {
  return {
    handle: scalarFromParams(source, CREATOR_SEARCH_HANDLE_PARAM),
    platforms: stringArrayFromParams(source, CREATOR_SEARCH_PLATFORM_PARAM),
    countries: countryCodesFromParams(source, CREATOR_SEARCH_COUNTRY_PARAM),
    languages: languagesFromParams(source),
    contentLanguages: stringArrayFromParams(source, CREATOR_SEARCH_CONTENT_LANGUAGE_PARAM).map(
      (code) => code.trim().toLowerCase()
    ),
    audienceCountries: countryCodesFromParams(source, CREATOR_SEARCH_AUDIENCE_COUNTRY_PARAM),
    audienceInterestTags: stringArrayFromParams(source, CREATOR_SEARCH_AUDIENCE_INTEREST_PARAM),
    contentKeyword: scalarFromParams(source, CREATOR_SEARCH_CONTENT_KEYWORD_PARAM),
    contentTags: stringArrayFromParams(source, CREATOR_SEARCH_CONTENT_TAG_PARAM),
    lastPostWithin: scalarFromParams(source, CREATOR_SEARCH_LAST_POST_PARAM),
    advancedSearch: booleanFromParams(source, CREATOR_SEARCH_ADVANCED_PARAM),
    gender: scalarFromParams(source, CREATOR_SEARCH_GENDER_PARAM),
    ageMin: scalarFromParams(source, CREATOR_SEARCH_AGE_MIN_PARAM),
    ageMax: scalarFromParams(source, CREATOR_SEARCH_AGE_MAX_PARAM),
    minFollowers: scalarFromParams(source, CREATOR_SEARCH_MIN_FOLLOWERS_PARAM),
    maxFollowers: scalarFromParams(source, CREATOR_SEARCH_MAX_FOLLOWERS_PARAM),
    minEngagement: scalarFromParams(source, CREATOR_SEARCH_MIN_ENGAGEMENT_PARAM),
    minViews: scalarFromParams(source, CREATOR_SEARCH_MIN_VIEWS_PARAM),
    minEstimatedCost: scalarFromParams(source, CREATOR_SEARCH_MIN_COST_PARAM),
    maxEstimatedCost: scalarFromParams(source, CREATOR_SEARCH_MAX_COST_PARAM),
    categories: categoriesFromUrlParams(source),
    minBrandSafety: scalarFromParams(source, CREATOR_SEARCH_MIN_BRAND_SAFETY_PARAM),
    aiNiche: scalarFromParams(source, CREATOR_SEARCH_AI_NICHE_PARAM),
    minThinkwayScore: scalarFromParams(source, CREATOR_SEARCH_MIN_THINKWAY_PARAM),
    minBrandFit: scalarFromParams(source, CREATOR_SEARCH_MIN_BRAND_FIT_PARAM),
    minAiScore: scalarFromParams(source, CREATOR_SEARCH_MIN_AI_SCORE_PARAM),
  };
}

/** Merge URL params onto default filter state (excludes top-bar `q` search). */
export function creatorSearchFiltersFromUrlParams(source: UrlReader): CreatorSearchFilters {
  return {
    ...cloneCreatorSearchFilters(),
    ...filtersFromUrlParams(source),
  };
}

/** True when filter fields represented in the URL match (ignores `search`). */
export function creatorSearchFiltersUrlEqual(
  a: CreatorSearchFilters,
  b: CreatorSearchFilters
): boolean {
  return (
    a.handle === b.handle &&
    stringArraysEqual(a.platforms, b.platforms) &&
    stringArraysEqual(a.countries, b.countries) &&
    stringArraysEqual(a.languages, b.languages) &&
    stringArraysEqual(a.contentLanguages, b.contentLanguages) &&
    stringArraysEqual(a.audienceCountries, b.audienceCountries) &&
    stringArraysEqual(a.audienceInterestTags, b.audienceInterestTags) &&
    a.contentKeyword === b.contentKeyword &&
    stringArraysEqual(a.contentTags, b.contentTags) &&
    a.lastPostWithin === b.lastPostWithin &&
    a.advancedSearch === b.advancedSearch &&
    a.gender === b.gender &&
    a.ageMin === b.ageMin &&
    a.ageMax === b.ageMax &&
    a.minFollowers === b.minFollowers &&
    a.maxFollowers === b.maxFollowers &&
    a.minEngagement === b.minEngagement &&
    a.minViews === b.minViews &&
    a.minEstimatedCost === b.minEstimatedCost &&
    a.maxEstimatedCost === b.maxEstimatedCost &&
    categoriesEqual(a.categories, b.categories) &&
    a.minBrandSafety === b.minBrandSafety &&
    a.aiNiche === b.aiNiche &&
    a.minThinkwayScore === b.minThinkwayScore &&
    a.minBrandFit === b.minBrandFit &&
    a.minAiScore === b.minAiScore
  );
}
/** Write creator search filters to URL params without touching reserved keys (`q`, brief, profileId, mode). */
export function applyCreatorSearchFiltersToUrlParams(
  params: URLSearchParams,
  filters: CreatorSearchFilters
): URLSearchParams {
  for (const param of FILTER_MANAGED_PARAMS) {
    params.delete(param);
  }

  applyCategoriesToUrlParams(params, filters.categories);
  applyCountryCodesToParams(params, CREATOR_SEARCH_COUNTRY_PARAM, filters.countries);
  applyStringArrayToParams(params, CREATOR_SEARCH_PLATFORM_PARAM, filters.platforms);
  applyCountryCodesToParams(
    params,
    CREATOR_SEARCH_AUDIENCE_COUNTRY_PARAM,
    filters.audienceCountries
  );
  applyStringArrayToParams(
    params,
    CREATOR_SEARCH_AUDIENCE_INTEREST_PARAM,
    filters.audienceInterestTags
  );
  applyStringArrayToParams(params, CREATOR_SEARCH_CONTENT_TAG_PARAM, filters.contentTags);
  applyStringArrayToParams(
    params,
    CREATOR_SEARCH_LANGUAGE_PARAM,
    filters.languages.map((code) => code.trim().toLowerCase()).filter(Boolean)
  );
  applyStringArrayToParams(
    params,
    CREATOR_SEARCH_CONTENT_LANGUAGE_PARAM,
    filters.contentLanguages.map((code) => code.trim().toLowerCase()).filter(Boolean)
  );
  applyScalarToParams(params, CREATOR_SEARCH_HANDLE_PARAM, filters.handle);
  applyScalarToParams(params, CREATOR_SEARCH_CONTENT_KEYWORD_PARAM, filters.contentKeyword);
  applyScalarToParams(params, CREATOR_SEARCH_LAST_POST_PARAM, filters.lastPostWithin);
  applyScalarToParams(params, CREATOR_SEARCH_GENDER_PARAM, filters.gender);
  applyScalarToParams(params, CREATOR_SEARCH_AGE_MIN_PARAM, filters.ageMin);
  applyScalarToParams(params, CREATOR_SEARCH_AGE_MAX_PARAM, filters.ageMax);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_FOLLOWERS_PARAM, filters.minFollowers);
  applyScalarToParams(params, CREATOR_SEARCH_MAX_FOLLOWERS_PARAM, filters.maxFollowers);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_ENGAGEMENT_PARAM, filters.minEngagement);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_VIEWS_PARAM, filters.minViews);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_COST_PARAM, filters.minEstimatedCost);
  applyScalarToParams(params, CREATOR_SEARCH_MAX_COST_PARAM, filters.maxEstimatedCost);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_BRAND_SAFETY_PARAM, filters.minBrandSafety);
  applyScalarToParams(params, CREATOR_SEARCH_AI_NICHE_PARAM, filters.aiNiche);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_THINKWAY_PARAM, filters.minThinkwayScore);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_BRAND_FIT_PARAM, filters.minBrandFit);
  applyScalarToParams(params, CREATOR_SEARCH_MIN_AI_SCORE_PARAM, filters.minAiScore);
  applyBooleanToParams(params, CREATOR_SEARCH_ADVANCED_PARAM, filters.advancedSearch);

  return params;
}

export { CREATOR_SEARCH_QUERY_PARAM };
