export type CreatorSearchFilters = {
  search: string;
  handle: string;
  platforms: string[];
  country: string;
  language: string;
  audienceCountry: string;
  audienceInterests: string;
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
  country: "",
  language: "",
  audienceCountry: "",
  audienceInterests: "",
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
  { value: "followers", label: "Followers", defaultDirection: "desc" },
  { value: "engagement", label: "Engagement rate", defaultDirection: "desc" },
  { value: "views", label: "Avg views", defaultDirection: "desc" },
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
  field: "relevance",
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
export function buildActiveFilterChips(filters: CreatorSearchFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

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
  if (filters.country.trim()) {
    chips.push({ id: "country", label: `Country: ${filters.country.trim()}`, clear: { country: "" } });
  }
  if (filters.language.trim()) {
    chips.push({ id: "language", label: `Language: ${filters.language.trim()}`, clear: { language: "" } });
  }
  if (filters.audienceCountry.trim()) {
    chips.push({
      id: "audienceCountry",
      label: `Audience: ${filters.audienceCountry.trim()}`,
      clear: { audienceCountry: "" },
    });
  }
  if (filters.audienceInterests.trim()) {
    chips.push({
      id: "audienceInterests",
      label: `Interests: ${filters.audienceInterests.trim()}`,
      clear: { audienceInterests: "" },
    });
  }
  if (filters.gender.trim()) {
    chips.push({ id: "gender", label: `Gender: ${filters.gender.trim()}`, clear: { gender: "" } });
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

export function filtersToBrowseParams(filters: CreatorSearchFilters, page: number, pageSize: number) {
  const search = [filters.search.trim(), filters.handle.trim()].filter(Boolean).join(" ");
  const minAi = [filters.minAiScore, filters.minBrandFit]
    .map((v) => (v ? Number(v) : NaN))
    .filter((n) => !Number.isNaN(n));
  const minAiScore = minAi.length ? Math.max(...minAi) : undefined;

  return {
    search: search || undefined,
    platform: filters.platforms.length === 1 ? filters.platforms[0] : undefined,
    platforms: filters.platforms.length > 1 ? filters.platforms : undefined,
    country: filters.country.trim() || undefined,
    language: filters.language.trim() || undefined,
    categories: filters.categories.length > 0 ? filters.categories : undefined,
    minFollowers: filters.minFollowers ? Number(filters.minFollowers) : undefined,
    maxFollowers: filters.maxFollowers ? Number(filters.maxFollowers) : undefined,
    minEngagement: filters.minEngagement ? Number(filters.minEngagement) : undefined,
    minViews: filters.minViews ? Number(filters.minViews) : undefined,
    minAiScore,
    minThinkwayScore: filters.minThinkwayScore ? Number(filters.minThinkwayScore) : undefined,
    productionOnly: true as const,
    page,
    pageSize,
  };
}
