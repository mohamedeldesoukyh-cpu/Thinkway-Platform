import { CREATOR_CATEGORY_KEYWORDS } from "@/lib/creators/category-keywords";
import { COUNTRY_OPTIONS } from "@/lib/master-data/constants";
import { DISCOVERY_PLATFORMS } from "@/lib/discovery/types";

import {
  parseCreatorSearchQuery,
  stripWorkflowBoilerplateForIntent,
  type ParsedCreatorSearch,
} from "./creator-search-parser";

export type CampaignSearchIndustryKey =
  | "baby"
  | "sports_fitness"
  | "luxury"
  | "travel"
  | "finance"
  | "tourism"
  | "general";

export type CampaignSearchIntent = {
  rawBrief: string;
  industry: string;
  industryKey: CampaignSearchIndustryKey;
  audience?: string;
  categories: string[];
  interests: string[];
  hashtags: string[];
  keywords: string[];
  semanticKeywords: string[];
  country?: string;
  city?: string;
  language?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  platforms: string[];
  parsed: ParsedCreatorSearch;
};

const INDUSTRY_SIGNALS: Array<{ key: CampaignSearchIndustryKey; label: string; patterns: RegExp[] }> =
  [
    {
      key: "baby",
      label: "Baby Care",
      patterns: [/babyjoy|diaper|diapers|baby care|infant|newborn|0.?3 years|toddler/i],
    },
    {
      key: "sports_fitness",
      label: "Sports & Fitness",
      patterns: [/adidas|nike|sportswear|running|fitness|gym|workout|athlete|sneaker/i],
    },
    {
      key: "tourism",
      label: "Tourism",
      patterns: [/visit egypt|tourism|destination marketing|tourist|sightseeing/i],
    },
    {
      key: "luxury",
      label: "Luxury & Hospitality",
      patterns: [/luxury|5-star|(?:luxury|hotel)\s+\w+|hospitality|prestige|rolex|haute/i],
    },
    {
      key: "travel",
      label: "Travel",
      patterns: [/travel creator|travel influencer|\btravel\b.*\b(?:creator|influencer)/i],
    },
    {
      key: "finance",
      label: "Finance",
      patterns: [/emirates nbd|\bbank\b|finance|fintech|insurance|credit card|wealth|invest/i],
    },
  ];

/** Industry-specific category expansion — OR-matched against creator tags / interests. */
export const INDUSTRY_CATEGORY_EXPANSION: Readonly<
  Record<CampaignSearchIndustryKey, readonly string[]>
> = {
  baby: [
    "Parenting",
    "Motherhood",
    "Family",
    "Baby",
    "Kids",
    "Mom",
    "Maternity",
    "Pregnancy",
    "Parent Life",
    "Lifestyle",
  ],
  sports_fitness: [
    "Fitness",
    "Sports",
    "Running",
    "Workout",
    "Athlete",
    "Lifestyle",
    "Fashion",
  ],
  luxury: ["Luxury", "Travel", "Lifestyle", "Fashion", "Hospitality"],
  travel: ["Travel", "Lifestyle", "Adventure", "Hospitality"],
  tourism: ["Travel", "Tourism", "Lifestyle", "Adventure", "Hospitality"],
  finance: ["Finance", "Business", "Lifestyle", "Tech"],
  general: ["Lifestyle"],
};

const INDUSTRY_SEMANTIC_KEYWORDS: Readonly<Record<CampaignSearchIndustryKey, readonly string[]>> =
  {
    baby: ["parenting", "motherhood", "baby", "family", "mom"],
    sports_fitness: ["fitness", "sports", "running", "workout", "athlete"],
    luxury: ["luxury", "travel", "hotel", "resort", "hospitality"],
    travel: ["travel", "destination", "adventure"],
    tourism: ["tourism", "travel", "destination", "egypt"],
    finance: ["finance", "banking", "money", "investment"],
    general: ["creator", "influencer"],
  };

const DEFAULT_INDUSTRY_PLATFORMS: Readonly<Record<CampaignSearchIndustryKey, readonly string[]>> = {
  baby: ["instagram", "tiktok"],
  sports_fitness: ["instagram", "tiktok"],
  luxury: ["instagram"],
  travel: ["instagram", "tiktok"],
  tourism: ["instagram", "tiktok", "youtube"],
  finance: ["instagram", "youtube"],
  general: ["instagram", "tiktok"],
};

const PLATFORM_KEYWORDS: Readonly<Record<string, (typeof DISCOVERY_PLATFORMS)[number]>> = {
  instagram: "instagram",
  insta: "instagram",
  tiktok: "tiktok",
  youtube: "youtube",
  twitter: "twitter",
  linkedin: "twitter",
};

const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  uae: "AE",
  emirates: "AE",
  dubai: "AE",
  "abu dhabi": "AE",
  ksa: "SA",
  saudi: "SA",
  uk: "GB",
  usa: "US",
  egypt: "EG",
  cairo: "EG",
  alexandria: "EG",
};

const CAMPAIGN_BRIEF_SIGNALS =
  /\b(?:launch|campaign|budget|objective|duration|target|awareness|ugc|conversion|weeks?|egp|usd|aed)\b/i;

const AUDIENCE_PATTERNS = [
  /\btarget(?:ing)?\s+(.+?)(?:\.|,|\n|$)/i,
  /\baudience[:\s]+(.+?)(?:\.|,|\n|$)/i,
  /\bfor\s+(new parents|mothers?|parents?|families|active lifestyle|young adults)[^.,\n]*/i,
];

const AGE_RANGE_PATTERN = /\b(\d{1,2})\s*[–-]\s*(\d{1,2})\s*(?:years?)?\b/i;

const GENDER_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\b(?:women|mothers?|female|girls?)\b/i, value: "female" },
  { pattern: /\b(?:men|male|boys?)\b/i, value: "male" },
];

const LANGUAGE_PATTERNS: ReadonlyArray<{ pattern: RegExp; value: string }> = [
  { pattern: /\barabic\b/i, value: "ar" },
  { pattern: /\benglish\b/i, value: "en" },
];

const CITY_ALIASES: Readonly<Record<string, string>> = {
  dubai: "Dubai",
  cairo: "Cairo",
  alexandria: "Alexandria",
  "abu dhabi": "Abu Dhabi",
};

function normalizePhrase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIndustry(text: string): { key: CampaignSearchIndustryKey; label: string } {
  for (const signal of INDUSTRY_SIGNALS) {
    if (signal.patterns.some((pattern) => pattern.test(text))) {
      return { key: signal.key, label: signal.label };
    }
  }
  return { key: "general", label: "General" };
}

function extractHashtags(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(/#([\w\u0600-\u06FF]+)/g)) {
    const tag = match[1]?.trim();
    if (tag) tags.add(tag.toLowerCase());
  }
  return [...tags];
}

function extractAudience(text: string): string | undefined {
  for (const pattern of AUDIENCE_PATTERNS) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim() ?? match?.[0]?.trim();
    if (value && value.length >= 4) return value.replace(/^for\s+/i, "").trim();
  }
  return undefined;
}

function extractAgeRange(text: string): { min?: number; max?: number } {
  const match = text.match(AGE_RANGE_PATTERN);
  if (!match) return {};
  const min = Number.parseInt(match[1] ?? "", 10);
  const max = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return {};
  return { min, max };
}

function extractGender(text: string): string | undefined {
  for (const { pattern, value } of GENDER_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return undefined;
}

function extractLanguage(text: string): string | undefined {
  for (const { pattern, value } of LANGUAGE_PATTERNS) {
    if (pattern.test(text)) return value;
  }
  return undefined;
}

function extractCity(text: string): string | undefined {
  const normalized = normalizePhrase(text);
  for (const [phrase, city] of Object.entries(CITY_ALIASES)) {
    if (normalized.includes(phrase)) return city;
  }
  return undefined;
}

function extractCountryFromText(text: string): string | undefined {
  const normalized = normalizePhrase(text);
  for (const [phrase, code] of Object.entries(COUNTRY_ALIASES)) {
    const pattern = new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
    if (pattern.test(normalized)) return code;
  }
  for (const option of COUNTRY_OPTIONS) {
    const phrase = normalizePhrase(option.label);
    const pattern = new RegExp(`(?:^|\\s)${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$)`, "i");
    if (pattern.test(normalized)) return option.value;
  }
  return undefined;
}

function extractPlatforms(text: string): string[] {
  const platforms = new Set<string>();
  const normalized = normalizePhrase(text);
  for (const [keyword, platform] of Object.entries(PLATFORM_KEYWORDS)) {
    const pattern = new RegExp(`(?:^|\\s)${keyword}(?=\\s|$)`, "i");
    if (pattern.test(normalized)) platforms.add(platform);
  }
  return [...platforms];
}

function extractKeywordCategories(text: string): string[] {
  const categories = new Set<string>();
  const normalized = normalizePhrase(text);
  for (const [keyword, label] of Object.entries(CREATOR_CATEGORY_KEYWORDS)) {
    const pattern = new RegExp(`(?:^|\\s)${keyword}(?=\\s|$)`, "i");
    if (pattern.test(normalized)) categories.add(label);
  }
  return [...categories];
}

function extractBriefKeywords(text: string, industryKey: CampaignSearchIndustryKey): string[] {
  const tokens = normalizePhrase(text)
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter(
      (token) =>
        ![
          "launch",
          "campaign",
          "budget",
          "duration",
          "objective",
          "target",
          "weeks",
          "premium",
          "product",
          "collection",
          "awareness",
          "conversion",
          "egp",
          "usd",
          "aed",
        ].includes(token)
    );

  const keywords = new Set<string>(INDUSTRY_SEMANTIC_KEYWORDS[industryKey]);
  for (const token of tokens.slice(0, 8)) {
    keywords.add(token);
  }
  return [...keywords].slice(0, 8);
}

function mergeUniqueCategories(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const category of list ?? []) {
      const value = category.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(value);
    }
  }
  return merged;
}

/** True when input looks like a campaign brief rather than a direct creator search query. */
export function looksLikeCampaignBrief(raw: string): boolean {
  const text = stripWorkflowBoilerplateForIntent(raw).trim();
  if (!text) return false;
  if (text.length >= 120) return true;
  if (CAMPAIGN_BRIEF_SIGNALS.test(text) && text.split(/[.!?]/).filter((s) => s.trim()).length >= 2) {
    return true;
  }
  return CAMPAIGN_BRIEF_SIGNALS.test(text) && text.length >= 60;
}

/**
 * Convert a campaign brief or natural-language request into structured discovery filters.
 * Never returns the raw brief as a search string.
 */
export function buildCampaignSearchIntent(rawBrief: string): CampaignSearchIntent {
  const preprocessed = stripWorkflowBoilerplateForIntent(rawBrief);
  const parsed = parseCreatorSearchQuery(preprocessed);
  const { key: industryKey, label: industry } = detectIndustry(preprocessed);
  const expandedCategories = [...INDUSTRY_CATEGORY_EXPANSION[industryKey]];
  const keywordCategories = extractKeywordCategories(preprocessed);
  const categories = mergeUniqueCategories(
    parsed.categories,
    keywordCategories,
    expandedCategories.slice(0, 6)
  );

  const country = parsed.country ?? extractCountryFromText(preprocessed);
  const city = extractCity(preprocessed);
  const explicitPlatforms = parsed.platforms?.length
    ? parsed.platforms
    : extractPlatforms(preprocessed);
  const platforms =
    explicitPlatforms.length > 0
      ? explicitPlatforms
      : [...DEFAULT_INDUSTRY_PLATFORMS[industryKey]];

  const age = extractAgeRange(preprocessed);
  const semanticKeywords = extractBriefKeywords(preprocessed, industryKey);

  return {
    rawBrief: preprocessed,
    industry,
    industryKey,
    audience: extractAudience(preprocessed),
    categories,
    interests: expandedCategories,
    hashtags: extractHashtags(preprocessed),
    keywords: semanticKeywords,
    semanticKeywords,
    country,
    city,
    language: extractLanguage(preprocessed),
    gender: extractGender(preprocessed),
    ageMin: age.min,
    ageMax: age.max,
    platforms,
    parsed,
  };
}

export function expandCategoriesForIndustry(
  industryKey: CampaignSearchIndustryKey,
  seedCategories: string[] = []
): string[] {
  return mergeUniqueCategories(seedCategories, [...INDUSTRY_CATEGORY_EXPANSION[industryKey]]);
}

export function semanticKeywordsForIndustry(industryKey: CampaignSearchIndustryKey): string[] {
  return [...INDUSTRY_SEMANTIC_KEYWORDS[industryKey]];
}
