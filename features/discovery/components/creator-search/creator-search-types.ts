import { countryLabel, LAST_POST_WITHIN_OPTIONS } from "./creator-search-filter-constants";

export type CreatorSearchFilters = {
  search: string;
  handle: string;
  platforms: string[];
  /** Creator location — first entry is sent to browse RPC; all apply client-side OR filter. */
  countries: string[];
  language: string;
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
  language: "",
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
  field: "followers",
  direction: "desc",
};

export function defaultDirectionForSortField(
  field: CreatorSearchSortField
): CreatorSearchSortDirection {
  return (
    CREATOR_SEARCH_SORT_FIELDS.find((option) => option.value === field)?.defaultDirection ?? "desc"
  );
}

/** A removable filter pill shown above the result list. */
export type ActiveFilterChip = {
  id: string;
  label: string;
  /** Patch applied to clear this single chip. */
  clear: Partial<CreatorSearchFilters>;
};


const PLATFORM_CHIP_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitter: "X (Twitter)",
};

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
      clear: { search: "" },
    });
  }
  if (filters.contentKeyword.trim()) {
    chips.push({
      id: "contentKeyword",
      label: `Keyword: ${filters.contentKeyword.trim()}`,
      clear: { contentKeyword: "" },
    });
  }
  for (const tag of filters.contentTags) {
    chips.push({
      id: `contentTag:${tag}`,
      label: `Tag: ${tag.startsWith("#") ? tag : `#${tag}`}`,
      clear: { contentTags: filters.contentTags.filter((value) => value !== tag) },
    });
  }
  if (filters.lastPostWithin) {
    chips.push({
      id: "lastPostWithin",
      label: `Last post: ${lastPostWithinLabel(filters.lastPostWithin)}`,
      clear: { lastPostWithin: "" },
    });
  }
  if (filters.handle.trim()) {
    chips.push({ id: "handle", label: `Handle: ${filters.handle.trim()}`, clear: { handle: "" } });
  }
  for (const platform of filters.platforms) {
    chips.push({
      id: `platform:${platform}`,
      label: PLATFORM_CHIP_LABELS[platform] ?? platform,
      clear: { platforms: filters.platforms.filter((p) => p !== platform) },
    });
  }
  for (const code of filters.countries) {
    chips.push({
      id: `country:${code}`,
      label: `Creator country: ${countryLabel(code)}`,
      clear: { countries: filters.countries.filter((value) => value !== code) },
    });
  }
  if (filters.language.trim()) {
    chips.push({ id: "language", label: `Language: ${filters.language.trim()}`, clear: { language: "" } });
  }
  for (const code of filters.audienceCountries) {
    chips.push({
      id: `audienceCountry:${code}`,
      label: `Audience country: ${countryLabel(code)}`,
      clear: {
        audienceCountries: filters.audienceCountries.filter((value) => value !== code),
      },
    });
  }
  for (const interest of filters.audienceInterestTags) {
    chips.push({
      id: `audienceInterest:${interest}`,
      label: `Audience interest: ${interest}`,
      clear: {
        audienceInterestTags: filters.audienceInterestTags.filter((value) => value !== interest),
      },
    });
  }
  if (filters.gender.trim()) {
    chips.push({
      id: "gender",
      label: `Gender: ${formatGenderLabel(filters.gender)}`,
      clear: { gender: "" },
    });
  }
  if (filters.ageMin || filters.ageMax) {
    chips.push({
      id: "age",
      label: rangeLabel("Age", filters.ageMin, filters.ageMax),
      clear: { ageMin: "", ageMax: "" },
    });
  }
  if (filters.minFollowers || filters.maxFollowers) {
    chips.push({
      id: "followers",
      label: rangeLabel("Followers", filters.minFollowers, filters.maxFollowers),
      clear: { minFollowers: "", maxFollowers: "" },
    });
  }
  if (filters.minEngagement) {
    chips.push({
      id: "engagement",
      label: `Eng. ≥ ${filters.minEngagement}%`,
      clear: { minEngagement: "" },
    });
  }
  if (filters.minViews) {
    chips.push({ id: "views", label: `Views ≥ ${filters.minViews}`, clear: { minViews: "" } });
  }
  if (filters.minBrandSafety) {
    chips.push({
      id: "brandSafety",
      label: `Safety ≥ ${filters.minBrandSafety}`,
      clear: { minBrandSafety: "" },
    });
  }
  if (filters.aiNiche.trim()) {
    chips.push({ id: "aiNiche", label: `Niche: ${filters.aiNiche.trim()}`, clear: { aiNiche: "" } });
  }
  if (filters.minThinkwayScore) {
    chips.push({
      id: "thinkway",
      label: `TW AI ≥ ${filters.minThinkwayScore}`,
      clear: { minThinkwayScore: "" },
    });
  }
  if (filters.minBrandFit) {
    chips.push({
      id: "brandFit",
      label: `Brand fit ≥ ${filters.minBrandFit}`,
      clear: { minBrandFit: "" },
    });
  }
  if (filters.minAiScore) {
    chips.push({
      id: "aiQuality",
      label: `AI quality ≥ ${filters.minAiScore}`,
      clear: { minAiScore: "" },
    });
  }
  for (const category of filters.categories) {
    chips.push({
      id: `category:${category}`,
      label: `Category: ${category}`,
      clear: {
        categories: filters.categories.filter((value) => value !== category),
      },
    });
  }
  return chips;
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

  return {
    country: primaryCountry || undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    niches: nicheTags.length > 0 ? nicheTags : undefined,
    platforms: filters.platforms.length > 0 ? filters.platforms : undefined,
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

  return {
    search: search || undefined,
    platform: filters.platforms.length === 1 ? filters.platforms[0] : undefined,
    platforms: filters.platforms.length > 1 ? filters.platforms : undefined,
    country: primaryCountry || undefined,
    creatorCountries: filters.countries.length > 0 ? filters.countries : undefined,
    language: filters.language.trim() || undefined,
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
  return {
    platform: filters.platforms.length === 1 ? filters.platforms[0] : undefined,
    platforms: filters.platforms.length > 1 ? filters.platforms : undefined,
    productionOnly: true as const,
    page,
    pageSize,
    coverageIntent: buildCoverageIntent(filters),
  };
}

/** Active filter count per collapsible panel section. */
export function creatorSearchSectionFilterCounts(filters: CreatorSearchFilters) {
  const set = (value: string) => (value.trim() ? 1 : 0);
  const range = (a: string, b: string) => (a || b ? 1 : 0);

  return {
    content:
      set(filters.contentKeyword) +
      filters.contentTags.length +
      set(filters.lastPostWithin) +
      (filters.advancedSearch ? 0 : 0),
    audience:
      filters.audienceCountries.length +
      filters.audienceInterestTags.length +
      set(filters.gender) +
      range(filters.ageMin, filters.ageMax),
    metrics:
      set(filters.handle) +
      filters.platforms.length +
      filters.countries.length +
      set(filters.language) +
      range(filters.minFollowers, filters.maxFollowers) +
      set(filters.minEngagement) +
      set(filters.minViews) +
      filters.categories.length,
    commercial:
      range(filters.minEstimatedCost, filters.maxEstimatedCost) + set(filters.minBrandSafety),
    ai:
      set(filters.minThinkwayScore) +
      set(filters.aiNiche) +
      set(filters.minBrandFit) +
      set(filters.minAiScore),
  };
}
