import { CREATOR_CATEGORY_KEYWORDS } from "@/lib/creators/category-keywords";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { COUNTRY_ALIASES } from "@/lib/creators/country-code";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";
import { normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";
import {
  DEFAULT_CREATOR_SEARCH_FILTERS,
  filtersToBrowseParams,
  type CreatorSearchFilters,
} from "@/features/discovery/components/creator-search/creator-search-types";

import { TIER_FILTER_RANGES } from "@/lib/creators/influencer-tier";

/** Follower presets aligned with Discovery creator-search-filter-fields.tsx */
const FOLLOWER_TIER_KEYWORDS = TIER_FILTER_RANGES.map((range) => ({
  id: range.id,
  min: range.min,
  max: range.max,
}));

const CATEGORY_KEYWORDS = CREATOR_CATEGORY_KEYWORDS;

const PLATFORM_KEYWORDS: Readonly<Record<string, (typeof DISCOVERY_PLATFORMS)[number]>> = {
  instagram: "instagram",
  insta: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
  twitter: "twitter",
  x: "twitter",
};

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "best",
  "can",
  "creator",
  "creators",
  "find",
  "for",
  "from",
  "give",
  "how",
  "in",
  "influencer",
  "influencers",
  "list",
  "match",
  "matching",
  "me",
  "my",
  "of",
  "on",
  "or",
  "search",
  "show",
  "the",
  "to",
  "top",
  "vendor",
  "vendors",
  "who",
  "with",
]);


export type ParsedCreatorSearch = {
  /** FTS keywords only — geography and filter tokens stripped. */
  search: string;
  country?: string;
  platforms?: string[];
  categories?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  minEngagement?: number;
};

type GeographyMatch = {
  code: string;
  phrase: string;
};

function normalizePhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGeographyIndex(): GeographyMatch[] {
  const matches: GeographyMatch[] = [];

  for (const option of COUNTRY_OPTIONS) {
    matches.push({ code: option.value, phrase: normalizePhrase(option.label) });
  }

  for (const [phrase, code] of Object.entries(COUNTRY_ALIASES)) {
    matches.push({ code, phrase: normalizePhrase(phrase) });
  }

  return matches.sort((a, b) => b.phrase.length - a.phrase.length);
}

const GEOGRAPHY_INDEX = buildGeographyIndex();

/** Strip workflow task prompt wrappers before intent / filter extraction. */
export function stripWorkflowBoilerplateForIntent(raw: string): string {
  let query = raw.trim();
  if (!query) return "";

  const quotedForMatch = query.match(
    /(?:Execute searchCreators immediately for|matching|search for creators matching):\s*"([^"]+)"/i
  );
  if (quotedForMatch?.[1]?.trim()) {
    query = quotedForMatch[1].trim();
  }

  const criteriaMatch = query.match(/Search criteria:\s*([\s\S]+?)(?:\n\n|$)/i);
  if (criteriaMatch?.[1]?.trim()) {
    query = criteriaMatch[1].trim();
  }

  const userRequestMatch = query.match(/(?:User request|Request):\s*([\s\S]+?)(?:\n\n|$)/i);
  if (userRequestMatch?.[1]?.trim()) {
    query = userRequestMatch[1].trim();
  }

  return query
    .replace(
      /^(?:Execute searchCreators immediately for:|Search for creators matching this campaign\.\s*Execute searchCreators immediately[^.\n]*\.?\s*)/i,
      ""
    )
    .replace(/\.\s*Do NOT ask clarifying questions[\s\S]*$/i, "")
    .replace(/^Search criteria:\s*/i, "")
    .trim();
}

function removePhrase(text: string, phrase: string): string {
  if (!phrase) return text;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`, "gi");
  return text.replace(pattern, " ").replace(/\s+/g, " ").trim();
}

function extractGeography(text: string): { country?: string; remainder: string } {
  const normalized = normalizePhrase(text);
  let remainder = text;
  let country: string | undefined;

  for (const match of GEOGRAPHY_INDEX) {
    if (!match.phrase) continue;
    const pattern = new RegExp(
      `(?:^|\\s)${match.phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`,
      "i"
    );
    if (!pattern.test(normalized)) continue;
    country = match.code;
    remainder = removePhrase(remainder, match.phrase);
    break;
  }

  return { country, remainder };
}

function extractPlatforms(text: string): { platforms: string[]; remainder: string } {
  let remainder = text;
  const platforms = new Set<string>();

  for (const [keyword, platform] of Object.entries(PLATFORM_KEYWORDS)) {
    const pattern = new RegExp(`(?:^|\\s)${keyword}(?=\\s|$)`, "i");
    if (pattern.test(normalizePhrase(remainder))) {
      platforms.add(platform);
      remainder = removePhrase(remainder, keyword);
    }
  }

  return {
    platforms: [...platforms],
    remainder,
  };
}

function extractFollowerTier(text: string): {
  minFollowers?: number;
  maxFollowers?: number;
  remainder: string;
} {
  let remainder = text;

  for (const tier of FOLLOWER_TIER_KEYWORDS) {
    const pattern = new RegExp(`(?:^|\\s)${tier.id}(?:-tier|-influencers?)?(?=\\s|$)`, "i");
    if (!pattern.test(normalizePhrase(remainder))) continue;

    remainder = removePhrase(remainder, tier.id);
    return {
      minFollowers: tier.min,
      maxFollowers: tier.max,
      remainder,
    };
  }

  return { remainder };
}

function extractCategories(text: string): { categories: string[]; remainder: string } {
  const categories = new Set<string>();
  let remainder = text;

  for (const [keyword, label] of Object.entries(CATEGORY_KEYWORDS)) {
    const pattern = new RegExp(`(?:^|\\s)${keyword}(?=\\s|$)`, "i");
    if (!pattern.test(normalizePhrase(remainder))) continue;
    categories.add(label);
  }

  return { categories: [...categories], remainder };
}

function stripMarkdownSearchNoise(text: string): string {
  return text
    .replace(/\*+/g, " ")
    .replace(/[_~`]+/g, " ")
    .replace(/^[-*•\d.]+\s+/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSearchKeywords(
  text: string,
  categories: string[],
  allowCategoryKeywords: boolean
): string {
  const tokens = stripMarkdownSearchNoise(text)
    .split(/\s+/)
    .map((token) => token.replace(/^[@#]+/, "").trim())
    .filter(Boolean);

  const meaningful = tokens.filter((token) => {
    const lower = token.toLowerCase();
    if (SEARCH_STOP_WORDS.has(lower)) return false;
    if (PLATFORM_KEYWORDS[lower]) return false;
    if (FOLLOWER_TIER_KEYWORDS.some((tier) => tier.id === lower)) return false;
    if (COUNTRY_ALIASES[lower]) return false;
    if (!allowCategoryKeywords && CATEGORY_KEYWORDS[lower]) return false;
    return true;
  });

  if (meaningful.length > 0) {
    return meaningful.map((token) => token.toLowerCase()).join(" ");
  }

  if (allowCategoryKeywords && categories.length === 1) {
    const categoryKeyword = Object.entries(CATEGORY_KEYWORDS).find(
      ([, label]) => label === categories[0]
    )?.[0];
    if (categoryKeyword) return categoryKeyword;
  }

  if (tokens.length <= 1) {
    return (tokens[0] ?? text).toLowerCase();
  }

  return tokens
    .slice(0, 3)
    .map((token) => token.toLowerCase())
    .join(" ");
}

function looksLikeNaturalLanguageQuery(raw: string, parsed: {
  country?: string;
  platforms?: string[];
  minFollowers?: number;
}): boolean {
  if (parsed.country || parsed.platforms?.length || parsed.minFollowers != null) {
    return true;
  }

  const tokens = normalizePhrase(raw).split(/\s+/).filter(Boolean);
  return tokens.some((token) => SEARCH_STOP_WORDS.has(token));
}

/**
 * Parse natural-language creator search into structured Discovery-aligned filters.
 * Geography is mapped to ISO country codes and stripped from FTS search text.
 */
export function parseCreatorSearchQuery(raw: string): ParsedCreatorSearch {
  const preprocessed = stripMarkdownSearchNoise(stripWorkflowBoilerplateForIntent(raw));
  const normalized = normalizeDiscoverySearchQuery(preprocessed).trim();
  if (!normalized) {
    return { search: "" };
  }

  const geo = extractGeography(normalized);
  const platforms = extractPlatforms(geo.remainder);
  const followers = extractFollowerTier(platforms.remainder);
  const categoryMatches = extractCategories(followers.remainder);
  const naturalLanguage = looksLikeNaturalLanguageQuery(normalized, {
    country: geo.country,
    platforms: platforms.platforms,
    minFollowers: followers.minFollowers,
  });
  const categories = naturalLanguage ? categoryMatches.categories : [];
  const search = buildSearchKeywords(
    categoryMatches.remainder,
    categories,
    naturalLanguage
  );

  return {
    search,
    country: geo.country,
    platforms: platforms.platforms.length > 0 ? platforms.platforms : undefined,
    categories: categories.length > 0 ? categories : undefined,
    minFollowers: followers.minFollowers,
    maxFollowers: followers.maxFollowers,
  };
}

/** @deprecated Prefer parseCreatorSearchQuery — returns FTS keywords only. */
export function normalizeAiCreatorSearchQuery(raw: string): string {
  return parseCreatorSearchQuery(raw).search;
}

export function parsedCreatorSearchToDiscoveryFilters(
  parsed: ParsedCreatorSearch
): CreatorSearchFilters {
  return {
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    search: parsed.search,
    countries: parsed.country ? [parsed.country] : [],
    platforms: parsed.platforms ?? [],
    categories: parsed.categories ?? [],
    minFollowers: parsed.minFollowers != null ? String(parsed.minFollowers) : "",
    maxFollowers: parsed.maxFollowers != null ? String(parsed.maxFollowers) : "",
    minEngagement: parsed.minEngagement != null ? String(parsed.minEngagement) : "",
  };
}

const BROWSE_FILTER_KEYS: (keyof UnifiedCreatorBrowseFilters)[] = [
  "search",
  "platform",
  "platforms",
  "country",
  "language",
  "categories",
  "minFollowers",
  "maxFollowers",
  "minEngagement",
  "minViews",
  "minAiScore",
  "minThinkwayScore",
  "productionOnly",
  "page",
  "pageSize",
];

function pickBrowseComparable(
  filters: UnifiedCreatorBrowseFilters
): Record<string, unknown> {
  const comparable: Record<string, unknown> = {};
  for (const key of BROWSE_FILTER_KEYS) {
    if (filters[key] !== undefined) {
      comparable[key] = filters[key];
    }
  }
  return comparable;
}

/** Compare Discovery vs AI browse params before calling browseUnifiedCreators(). */
export function assertBrowseFilterParity(
  discoveryFilters: UnifiedCreatorBrowseFilters,
  aiFilters: UnifiedCreatorBrowseFilters
): { pass: boolean; diff: string[] } {
  const left = pickBrowseComparable(discoveryFilters);
  const right = pickBrowseComparable(aiFilters);
  const diff: string[] = [];
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of keys) {
    const leftValue = JSON.stringify(left[key] ?? null);
    const rightValue = JSON.stringify(right[key] ?? null);
    if (leftValue !== rightValue) {
      diff.push(`${key}: discovery=${leftValue} ai=${rightValue}`);
    }
  }

  return { pass: diff.length === 0, diff };
}

export function discoveryBrowseFiltersFromNaturalLanguage(
  message: string,
  page: number,
  pageSize: number
): UnifiedCreatorBrowseFilters {
  const parsed = parseCreatorSearchQuery(message);
  return filtersToBrowseParams(parsedCreatorSearchToDiscoveryFilters(parsed), page, pageSize);
}
