import { resolveDiscoveryPlatform } from "@/lib/social/platforms";

import { PLATFORM_LABELS } from "@/lib/social/platforms";

import { countryLabel, languageLabel, LAST_POST_WITHIN_OPTIONS } from "./creator-search-filter-constants";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import type { DiscoverySearchFilterKey } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";

export type CreatorSearchFilters = {
  search: string;
  handle: string;
  platforms: string[];
  /** Creator location — first entry is sent to browse RPC; all apply client-side OR filter. */
  countries: string[];
  /** Creator profile languages — first entry sent to SQL; OR within group client-side. */
  languages: string[];
  /** Content languages — client-side OR filter on language_codes. */
  contentLanguages: string[];
  /** Audience geography — client-side filter when enrichment data is sparse. */
  audienceCountries: string[];
  /** Audience interest tags — OR match against creator categories / niche. */
  audienceInterestTags: string[];
  /** Content keyword merged into FTS browse search (distinct from top-bar query). */
  contentKeyword: string;
  /** Hashtag / topic pills merged into browse search. */
  contentTags: string[];
  /** Recency window — client-side filter on recent publications when set. */
  lastPostWithin: string;
  advancedSearch: boolean;
  gender: string;
  ageMin: string;
  ageMax: string;
  minFollowers: string;
  maxFollowers: string;
  minEngagement: string;
  minViews: string;
  minAiScore: string;
  minThinkwayScore: string;
  minEstimatedCost: string;
  maxEstimatedCost: string;
  categories: string[];
  minBrandSafety: string;
  aiNiche: string;
  minBrandFit: string;
};

export const DEFAULT_CREATOR_SEARCH_FILTERS: CreatorSearchFilters = {
  search: "",
  handle: "",
  platforms: [],
  countries: [],
  languages: [],
  contentLanguages: [],
  audienceCountries: [],
  audienceInterestTags: [],
  contentKeyword: "",
  contentTags: [],
  lastPostWithin: "",
  advancedSearch: false,
  gender: "",
  ageMin: "",
  ageMax: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  minViews: "",
  minAiScore: "",
  minThinkwayScore: "",
  minEstimatedCost: "",
  maxEstimatedCost: "",
  categories: [],
  minBrandSafety: "",
  aiNiche: "",
  minBrandFit: "",
};

/** Deep-clone filter arrays — never mutate `DEFAULT_CREATOR_SEARCH_FILTERS` in place. */
export function cloneCreatorSearchFilters(
  base: CreatorSearchFilters = DEFAULT_CREATOR_SEARCH_FILTERS
): CreatorSearchFilters {
  return {
    ...base,
    platforms: [...base.platforms],
    countries: [...base.countries],
    languages: [...base.languages],
    contentLanguages: [...base.contentLanguages],
    audienceCountries: [...base.audienceCountries],
    audienceInterestTags: [...base.audienceInterestTags],
    contentTags: [...base.contentTags],
    categories: [...base.categories],
  };
}

function normalizePlatformFilterValues(platforms: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of platforms) {
    const platform = resolveDiscoveryPlatform(raw) ?? raw.trim().toLowerCase();
    if (!platform || seen.has(platform)) continue;
    seen.add(platform);
    normalized.push(platform);
  }
  return normalized;
}

export const CREATOR_SEARCH_SORT_FIELDS = [
  { value: "relevance", label: "Relevance", defaultDirection: "desc" },
  { value: "name", label: "Name", defaultDirection: "asc" },
  { value: "platform", label: "Platform", defaultDirection: "asc" },
  { value: "followers", label: "Followers", defaultDirection: "desc" },
  { value: "country", label: "Country", defaultDirection: "asc" },
  { value: "categories", label: "Categories", defaultDirection: "asc" },
  { value: "engagement", label: "Engagement rate", defaultDirection: "desc" },
  { value: "views", label: "Avg views", defaultDirection: "desc" },
  { value: "brand_safety", label: "Brand safety", defaultDirection: "desc" },
  { value: "source", label: "Source", defaultDirection: "asc" },
  { value: "thinkway", label: "Thinkway score", defaultDirection: "desc" },
  { value: "last_synced", label: "Last synced", defaultDirection: "desc" },
] as const;

export type CreatorSearchSortField = (typeof CREATOR_SEARCH_SORT_FIELDS)[number]["value"];

export type CreatorSearchSortDirection = "asc" | "desc";

export type CreatorSearchSortState = {
  field: CreatorSearchSortField;
  direction: CreatorSearchSortDirection;
};

/** @deprecated Use CreatorSearchSortField */
export type CreatorSearchSort = CreatorSearchSortField;

export const DEFAULT_CREATOR_SEARCH_SORT: CreatorSearchSortState = {
  field: "last_synced",
  direction: "desc",
};

export function defaultDirectionForSortField(
  field: CreatorSearchSortField
): CreatorSearchSortDirection {
  return (
    CREATOR_SEARCH_SORT_FIELDS.find((option) => option.value === field)?.defaultDirection ?? "desc"
  );
}

export type CreatorSearchFilterSectionId =
  | "search"
  | "creator"
  | "audience"
  | "performance"
  | "content"
  | "ai"
  | "advanced";

/** Active filter bar section labels (grouped chips). */
export const CREATOR_SEARCH_ACTIVE_FILTER_GROUPS: ReadonlyArray<{
  id: CreatorSearchFilterSectionId;
  label: string;
}> = [
  { id: "search", label: "Search" },
  { id: "creator", label: "Creator" },
  { id: "audience", label: "Audience" },
  { id: "performance", label: "Performance" },
  { id: "content", label: "Content" },
  { id: "advanced", label: "Advanced" },
  { id: "ai", label: "AI" },
] as const;

/** A removable filter pill shown above the result list. */
export type ActiveFilterChip = {
  id: string;
  label: string;
  section: CreatorSearchFilterSectionId;
  /** Patch applied to clear this single chip. */
  clear: Partial<CreatorSearchFilters>;
};


const PLATFORM_CHIP_LABELS: Record<string, string> = PLATFORM_LABELS;

function lastPostWithinLabel(value: string): string {
  return LAST_POST_WITHIN_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function formatGenderLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  return value.trim();
}

function rangeLabel(prefix: string, min: string, max: string): string {
  if (min && max) return `${prefix}: ${min}–${max}`;
  if (min) return `${prefix}: ≥ ${min}`;
  return `${prefix}: ≤ ${max}`;
}

/** True when any filter field or the top-bar search query differs from defaults. */
export function hasActiveCreatorSearchFilters(
  filters: CreatorSearchFilters,
  search = ""
): boolean {
  if (search.trim()) return true;

  for (const key of Object.keys(DEFAULT_CREATOR_SEARCH_FILTERS) as (keyof CreatorSearchFilters)[]) {
    const current = filters[key];
    const defaults = DEFAULT_CREATOR_SEARCH_FILTERS[key];
    if (Array.isArray(current)) {
      if (current.length > 0) return true;
    } else if (current !== defaults) {
      return true;
    }
  }

  return false;
}

/** Derives the set of removable chips from the current filter state. */
export function buildActiveFilterChips(
  filters: CreatorSearchFilters,
  topBarSearch = ""
): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (topBarSearch.trim()) {
    chips.push({
      id: "topSearch",
      label: `Search: ${topBarSearch.trim()}`,
      section: "search",
      clear: { search: "" },
    });
  }
  if (filters.contentKeyword.trim()) {
    chips.push({
      id: "contentKeyword",
      label: `Keyword: ${filters.contentKeyword.trim()}`,
      section: "content",
      clear: { contentKeyword: "" },
    });
  }
  for (const tag of filters.contentTags) {
    chips.push({
      id: `contentTag:${tag}`,
      label: `Tag: ${tag.startsWith("#") ? tag : `#${tag}`}`,
      section: "content",
      clear: { contentTags: filters.contentTags.filter((value) => value !== tag) },
    });
  }
  for (const lang of filters.contentLanguages) {
    chips.push({
      id: `contentLanguage:${lang}`,
      label: `Content language: ${languageLabel(lang)}`,
      section: "content",
      clear: {
        contentLanguages: filters.contentLanguages.filter((value) => value !== lang),
      },
    });
  }
  if (filters.lastPostWithin) {
    chips.push({
      id: "lastPostWithin",
      label: `Last post: ${lastPostWithinLabel(filters.lastPostWithin)}`,
      section: "advanced",
      clear: { lastPostWithin: "" },
    });
  }
  if (filters.handle.trim()) {
    chips.push({
      id: "handle",
      label: `Handle: ${filters.handle.trim()}`,
      section: "creator",
      clear: { handle: "" },
    });
  }
  for (const platform of filters.platforms) {
    chips.push({
      id: `platform:${platform}`,
      label: PLATFORM_CHIP_LABELS[platform] ?? platform,
      section: "creator",
      clear: { platforms: filters.platforms.filter((p) => p !== platform) },
    });
  }
  for (const code of filters.countries) {
    chips.push({
      id: `country:${code}`,
      label: `Creator country: ${countryLabel(code)}`,
      section: "creator",
      clear: { countries: filters.countries.filter((value) => value !== code) },
    });
  }
  for (const lang of filters.languages) {
    chips.push({
      id: `language:${lang}`,
      label: `Language: ${languageLabel(lang)}`,
      section: "creator",
      clear: { languages: filters.languages.filter((value) => value !== lang) },
    });
  }
  for (const code of filters.audienceCountries) {
    chips.push({
      id: `audienceCountry:${code}`,
      label: `Audience country: ${countryLabel(code)}`,
      section: "audience",
      clear: {
        audienceCountries: filters.audienceCountries.filter((value) => value !== code),
      },
    });
  }
  for (const interest of filters.audienceInterestTags) {
    chips.push({
      id: `audienceInterest:${interest}`,
      label: `Audience interest: ${interest}`,
      section: "audience",
      clear: {
        audienceInterestTags: filters.audienceInterestTags.filter((value) => value !== interest),
      },
    });
  }
  if (filters.gender.trim()) {
    chips.push({
      id: "gender",
      label: `Gender: ${formatGenderLabel(filters.gender)}`,
      section: "audience",
      clear: { gender: "" },
    });
  }
  if (filters.ageMin || filters.ageMax) {
    chips.push({
      id: "age",
      label: rangeLabel("Age", filters.ageMin, filters.ageMax),
      section: "audience",
      clear: { ageMin: "", ageMax: "" },
    });
  }
  if (filters.minFollowers || filters.maxFollowers) {
    chips.push({
      id: "followers",
      label: rangeLabel("Followers", filters.minFollowers, filters.maxFollowers),
      section: "performance",
      clear: { minFollowers: "", maxFollowers: "" },
    });
  }
  if (filters.minEngagement) {
    chips.push({
      id: "engagement",
      label: `Eng. ≥ ${filters.minEngagement}%`,
      section: "performance",
      clear: { minEngagement: "" },
    });
  }
  if (filters.minViews) {
    chips.push({
      id: "views",
      label: `Views ≥ ${filters.minViews}`,
      section: "performance",
      clear: { minViews: "" },
    });
  }
  if (filters.minEstimatedCost || filters.maxEstimatedCost) {
    chips.push({
      id: "pricing",
      label: rangeLabel("Pricing", filters.minEstimatedCost, filters.maxEstimatedCost),
      section: "advanced",
      clear: { minEstimatedCost: "", maxEstimatedCost: "" },
    });
  }
  if (filters.minBrandSafety) {
    chips.push({
      id: "brandSafety",
      label: `Safety ≥ ${filters.minBrandSafety}`,
      section: "ai",
      clear: { minBrandSafety: "" },
    });
  }
  if (filters.aiNiche.trim()) {
    chips.push({
      id: "aiNiche",
      label: `Niche: ${filters.aiNiche.trim()}`,
      section: "ai",
      clear: { aiNiche: "" },
    });
  }
  if (filters.minThinkwayScore) {
    chips.push({
      id: "thinkway",
      label: `TW AI ≥ ${filters.minThinkwayScore}`,
      section: "ai",
      clear: { minThinkwayScore: "" },
    });
  }
  if (filters.minBrandFit) {
    chips.push({
      id: "brandFit",
      label: `Brand fit ≥ ${filters.minBrandFit}`,
      section: "ai",
      clear: { minBrandFit: "" },
    });
  }
  if (filters.minAiScore) {
    chips.push({
      id: "aiQuality",
      label: `AI quality ≥ ${filters.minAiScore}`,
      section: "ai",
      clear: { minAiScore: "" },
    });
  }
  for (const category of filters.categories) {
    chips.push({
      id: `category:${category}`,
      label: `Category: ${category}`,
      section: "creator",
      clear: {
        categories: filters.categories.filter((value) => value !== category),
      },
    });
  }
  return chips;
}

/** Clears every active filter field belonging to a filter section in one action. */
export function clearCreatorSearchSectionFilters(
  section: CreatorSearchFilterSectionId,
  filters: CreatorSearchFilters
): CreatorSearchFilters {
  const next = cloneCreatorSearchFilters(filters);

  switch (section) {
    case "search":
      return { ...next, search: "" };
    case "creator":
      return {
        ...next,
        handle: "",
        platforms: [],
        countries: [],
        languages: [],
        categories: [],
      };
    case "audience":
      return {
        ...next,
        audienceCountries: [],
        audienceInterestTags: [],
        gender: "",
        ageMin: "",
        ageMax: "",
      };
    case "performance":
      return {
        ...next,
        minFollowers: "",
        maxFollowers: "",
        minEngagement: "",
        minViews: "",
        minEstimatedCost: "",
        maxEstimatedCost: "",
      };
    case "content":
      return {
        ...next,
        contentKeyword: "",
        contentTags: [],
        contentLanguages: [],
      };
    case "advanced":
      return {
        ...next,
        lastPostWithin: "",
        advancedSearch: false,
      };
    case "ai":
      return {
        ...next,
        minBrandSafety: "",
        aiNiche: "",
        minThinkwayScore: "",
        minBrandFit: "",
        minAiScore: "",
      };
    default:
      return next;
  }
}

function contentSearchTokens(filters: CreatorSearchFilters): string[] {
  const tags = filters.contentTags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return [filters.contentKeyword.trim(), ...tags].filter(Boolean);
}

function buildCoverageIntent(filters: CreatorSearchFilters) {
  const primaryCountry = filters.countries[0]?.trim().toUpperCase();
  const audienceSignal = [
    ...filters.audienceInterestTags,
    ...filters.categories,
    filters.aiNiche.trim(),
    filters.contentKeyword.trim(),
    ...filters.contentTags,
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(" ");

  const nicheTags = [
    ...filters.audienceInterestTags.map((tag) => tag.trim()).filter(Boolean),
    ...(filters.aiNiche.trim() ? [filters.aiNiche.trim()] : []),
  ];
  const platformFilters = normalizePlatformFilterValues(filters.platforms);

  return {
    country: primaryCountry || undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    niches: nicheTags.length > 0 ? nicheTags : undefined,
    platforms: platformFilters.length > 0 ? platformFilters : undefined,
    audience: audienceSignal || undefined,
    minFollowers: filters.minFollowers ? Number(filters.minFollowers) : undefined,
    maxFollowers: filters.maxFollowers ? Number(filters.maxFollowers) : undefined,
  };
}

export function filtersToBrowseParams(filters: CreatorSearchFilters, page: number, pageSize: number) {
  const search = [
    filters.search.trim(),
    filters.handle.trim(),
    ...contentSearchTokens(filters),
  ]
    .filter(Boolean)
    .join(" ");
  const minAi = [filters.minAiScore, filters.minBrandFit]
    .map((v) => (v ? Number(v) : NaN))
    .filter((n) => !Number.isNaN(n));
  const minAiScore = minAi.length ? Math.max(...minAi) : undefined;
  const primaryCountry = filters.countries[0]?.trim().toUpperCase();
  const primaryLanguage = filters.languages[0]?.trim().toLowerCase();
  const platformFilters = normalizePlatformFilterValues(filters.platforms);

  return {
    search: search || undefined,
    platform: platformFilters.length === 1 ? platformFilters[0] : undefined,
    platforms: platformFilters.length > 1 ? platformFilters : undefined,
    country: primaryCountry || undefined,
    creatorCountries: filters.countries.length > 0 ? filters.countries : undefined,
    language: primaryLanguage || undefined,
    languages: filters.languages.length > 0 ? filters.languages : undefined,
    contentLanguages:
      filters.contentLanguages.length > 0 ? filters.contentLanguages : undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    audienceCountries:
      filters.audienceCountries.length > 0 ? filters.audienceCountries : undefined,
    audienceInterestTags:
      filters.audienceInterestTags.length > 0 ? filters.audienceInterestTags : undefined,
    audienceGender: filters.gender.trim() || undefined,
    audienceAgeMin: filters.ageMin.trim() || undefined,
    audienceAgeMax: filters.ageMax.trim() || undefined,
    minFollowers: filters.minFollowers ? Number(filters.minFollowers) : undefined,
    maxFollowers: filters.maxFollowers ? Number(filters.maxFollowers) : undefined,
    minEngagement: filters.minEngagement ? Number(filters.minEngagement) : undefined,
    minViews: filters.minViews ? Number(filters.minViews) : undefined,
    minAiScore,
    minThinkwayScore: filters.minThinkwayScore ? Number(filters.minThinkwayScore) : undefined,
    productionOnly: true as const,
    page,
    pageSize,
    coverageIntent: buildCoverageIntent(filters),
  };
}

/**
 * Relaxed browse params for AI campaign search — avoids strict AND filters in SQL.
 * Audience/geo/category/keyword signals are scored client-side instead of excluding creators.
 */
export function filtersToRelaxedBrowseParams(
  filters: CreatorSearchFilters,
  page: number,
  pageSize: number
) {
  const platformFilters = normalizePlatformFilterValues(filters.platforms);
  return {
    platform: platformFilters.length === 1 ? platformFilters[0] : undefined,
    platforms: platformFilters.length > 1 ? platformFilters : undefined,
    productionOnly: true as const,
    page,
    pageSize,
    coverageIntent: buildCoverageIntent(filters),
  };
}

/** Active filter count per collapsible panel section. */
export function creatorSearchSectionFilterCounts(filters: CreatorSearchFilters) {
  const counts: Record<CreatorSearchFilterSectionId, number> = {
    search: 0,
    creator: 0,
    audience: 0,
    performance: 0,
    content: 0,
    ai: 0,
    advanced: 0,
  };

  for (const chip of buildActiveFilterChips(filters)) {
    counts[chip.section] += 1;
  }

  return counts;
}

/** Total removable active filter chips (excludes top-bar search when omitted). */
export function countActiveCreatorSearchFilterChips(
  filters: CreatorSearchFilters,
  topBarSearch = ""
): number {
  return buildActiveFilterChips(filters, topBarSearch).length;
}

function pushCriterion(
  criteria: CampaignSearchCriterion[],
  seed: Omit<CampaignSearchCriterion, "id"> & { id?: string }
): void {
  criteria.push({
    id: seed.id ?? `filter-${criteria.length + 1}`,
    kind: seed.kind,
    label: seed.label,
    value: seed.value,
    weight: seed.weight,
    enabled: seed.enabled,
    meta: seed.meta,
  });
}

/**
 * Converts manual Discovery filter state into campaign relevance criteria
 * for zero-results recommendations (reuses campaign-relevance-scoring.ts).
 */
export function creatorSearchFiltersToCriteria(
  filters: CreatorSearchFilters
): CampaignSearchCriterion[] {
  const criteria: CampaignSearchCriterion[] = [];

  for (const category of filters.categories) {
    pushCriterion(criteria, {
      kind: "category",
      label: "Category",
      value: category,
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "category", rawValue: category },
    });
  }
  for (const platform of normalizePlatformFilterValues(filters.platforms)) {
    pushCriterion(criteria, {
      kind: "platform",
      label: "Platform",
      value: platform,
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "platform", rawValue: platform },
    });
  }
  for (const code of filters.countries) {
    pushCriterion(criteria, {
      kind: "country",
      label: "Creator country",
      value: code.trim().toUpperCase(),
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "creator_country", rawValue: code },
    });
  }
  for (const code of filters.audienceCountries) {
    pushCriterion(criteria, {
      kind: "country",
      label: "Audience country",
      value: code.trim().toUpperCase(),
      weight: 2,
      enabled: true,
      meta: { discoveryKey: "audience_country", rawValue: code },
    });
  }
  for (const lang of filters.languages) {
    pushCriterion(criteria, {
      kind: "language",
      label: "Language",
      value: lang.trim().toLowerCase(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "language", rawValue: lang },
    });
  }
  for (const lang of filters.contentLanguages) {
    pushCriterion(criteria, {
      kind: "language",
      label: "Content language",
      value: lang.trim().toLowerCase(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "language" as DiscoverySearchFilterKey, rawValue: lang },
    });
  }
  for (const interest of filters.audienceInterestTags) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Audience interest",
      value: interest,
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "niche", rawValue: interest },
    });
  }
  for (const tag of filters.contentTags) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Content tag",
      value: tag,
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "content_tag", rawValue: tag },
    });
  }
  if (filters.contentKeyword.trim()) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Keyword",
      value: filters.contentKeyword.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "content_keyword", rawValue: filters.contentKeyword.trim() },
    });
  }
  if (filters.gender.trim()) {
    pushCriterion(criteria, {
      kind: "audience",
      label: "Gender",
      value: filters.gender.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "audience_gender", rawValue: filters.gender.trim() },
    });
  }
  if (filters.ageMin.trim()) {
    pushCriterion(criteria, {
      kind: "audience",
      label: "Min age",
      value: filters.ageMin.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "audience_age_min", rawValue: filters.ageMin.trim() },
    });
  }
  if (filters.ageMax.trim()) {
    pushCriterion(criteria, {
      kind: "audience",
      label: "Max age",
      value: filters.ageMax.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "audience_age_max", rawValue: filters.ageMax.trim() },
    });
  }
  if (filters.minFollowers.trim()) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Min followers",
      value: filters.minFollowers.trim(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "follower_min", rawValue: filters.minFollowers.trim() },
    });
  }
  if (filters.maxFollowers.trim()) {
    pushCriterion(criteria, {
      kind: "niche",
      label: "Max followers",
      value: filters.maxFollowers.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "follower_max", rawValue: filters.maxFollowers.trim() },
    });
  }
  if (filters.minEngagement.trim()) {
    pushCriterion(criteria, {
      kind: "engagement",
      label: "Engagement",
      value: filters.minEngagement.trim(),
      weight: 1.5,
      enabled: true,
      meta: { discoveryKey: "engagement_min", rawValue: filters.minEngagement.trim() },
    });
  }
  if (filters.minBrandSafety.trim()) {
    pushCriterion(criteria, {
      kind: "brand_fit",
      label: "Brand safety",
      value: filters.minBrandSafety.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "brand_safety_min", rawValue: filters.minBrandSafety.trim() },
    });
  }
  if (filters.minThinkwayScore.trim()) {
    pushCriterion(criteria, {
      kind: "authenticity",
      label: "Thinkway score",
      value: filters.minThinkwayScore.trim(),
      weight: 1,
      enabled: true,
      meta: { discoveryKey: "brand_fit_min", rawValue: filters.minThinkwayScore.trim() },
    });
  }

  return criteria;
}
