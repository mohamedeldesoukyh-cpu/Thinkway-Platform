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
  category: string;
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
  category: "",
  minBrandSafety: "",
  aiNiche: "",
  minBrandFit: "",
};

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
    category: filters.category.trim() || filters.aiNiche.trim() || undefined,
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
