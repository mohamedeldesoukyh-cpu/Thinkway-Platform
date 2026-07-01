import { normalizeDiscoverySearchQuery } from "@/lib/discovery/creator-search-query";

import {
  matchQueryAgainstTaxonomy,
  normalizeDiscoveryTaxonomyWord,
  type DiscoverySearchTaxonomy,
  type TaxonomyMatchResult,
} from "./creator-search-taxonomy";

export type CreatorSearchIntentMode = "exact" | "hybrid" | "discovery";

export type CreatorSearchIntentSignals = {
  rawQuery: string;
  normalizedQuery: string;
  tokenCount: number;
  queryLength: number;
  hasAtPrefix: boolean;
  hasHashtagPrefix: boolean;
  handlePatternScore: number;
  personNameScore: number;
  taxonomyMatch: TaxonomyMatchResult;
  taxonomyPenalty: number;
  genericTermPenalty: number;
  shortQueryPenalty: number;
  multiWordDiscoveryBoost: number;
};

export type CreatorSearchIntentResult = {
  mode: CreatorSearchIntentMode;
  confidence: number;
  signals: CreatorSearchIntentSignals;
};

const MIN_EXACT_CREATOR_QUERY_LENGTH = 3;

const GENERIC_SEARCH_TERMS = new Set([
  "account",
  "accounts",
  "blogger",
  "bloggers",
  "creator",
  "creators",
  "influencer",
  "influencers",
  "profile",
  "profiles",
  "user",
  "users",
]);

function stripAtPrefix(value: string): string {
  return value.replace(/^@+/, "").trim();
}

function looksLikeHandle(query: string): boolean {
  const handle = stripAtPrefix(query);
  if (handle.length < MIN_EXACT_CREATOR_QUERY_LENGTH) return false;
  if (/\s/.test(handle)) return false;
  if (!/^[a-z0-9._-]+$/i.test(handle)) return false;
  if (/^[a-z0-9._-]*[._-][a-z0-9._-]*$/i.test(handle)) return true;
  return /^[a-z0-9]{3,}$/i.test(handle);
}

function scoreHandlePattern(query: string): number {
  const handle = stripAtPrefix(query);
  if (handle.length < MIN_EXACT_CREATOR_QUERY_LENGTH) return 0;
  if (!looksLikeHandle(query)) return 0;

  let score = 38;
  if (query.trim().startsWith("@")) score += 12;
  if (/[._-]/.test(handle)) score += 8;
  if (/[0-9]/.test(handle)) score += 4;
  score += Math.min(handle.length, 18) * 1.5;
  return Math.min(score, 72);
}

function looksLikePersonName(query: string, taxonomyMatch: TaxonomyMatchResult): boolean {
  const trimmed = query.trim();
  if (taxonomyMatch.level === "full" || taxonomyMatch.level === "all_words") return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (words.some((word) => GENERIC_SEARCH_TERMS.has(word.toLowerCase()))) return false;

  const allLetters = words.every((word) => /^[\p{L}'-]+$/u.test(word) && word.length >= 2);
  if (!allLetters) return false;

  const titleCase = words.every((word) => /^[\p{Lu}][\p{L}'-]*$/u.test(word));
  const allLower = words.every((word) => word === word.toLowerCase());
  return titleCase || allLower;
}

function scorePersonName(query: string, taxonomyMatch: TaxonomyMatchResult): number {
  if (!looksLikePersonName(query, taxonomyMatch)) return 0;
  const words = query.trim().split(/\s+/).filter(Boolean);
  return Math.min(48 + words.length * 6, 68);
}

function scoreTaxonomyPenalty(taxonomyMatch: TaxonomyMatchResult): number {
  switch (taxonomyMatch.level) {
    case "full":
      return 55;
    case "all_words":
      return 48;
    case "partial":
      return 28;
    default:
      return 0;
  }
}

function scoreGenericTermPenalty(query: string): number {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.some((word) => GENERIC_SEARCH_TERMS.has(word))) return 22;
  return 0;
}

function scoreShortQueryPenalty(comparable: string): number {
  if (comparable.length === 0) return 60;
  if (comparable.length < MIN_EXACT_CREATOR_QUERY_LENGTH) return 45;
  return 0;
}

function scoreMultiWordDiscoveryBoost(
  query: string,
  taxonomyMatch: TaxonomyMatchResult,
  personNameScore: number,
  handlePatternScore: number
): number {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return 0;
  if (personNameScore > 0 || handlePatternScore > 0) return 0;
  if (taxonomyMatch.level !== "none") return 0;
  return 18;
}

function resolveMode(confidence: number): CreatorSearchIntentMode {
  if (confidence >= 95) return "exact";
  if (confidence >= 60) return "hybrid";
  return "discovery";
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Score debounced search intent using dynamic taxonomy and handle/name heuristics.
 * Call only after the debounce pause (250ms).
 */
export function scoreCreatorSearchIntent(
  rawQuery: string,
  taxonomy: DiscoverySearchTaxonomy
): CreatorSearchIntentResult {
  const rawTrimmed = rawQuery.trim();
  const hasHashtagPrefix = rawTrimmed.startsWith("#");

  if (!rawTrimmed) {
    return emptyIntentResult(rawQuery, taxonomy, {
      shortQueryPenalty: 60,
    });
  }

  if (hasHashtagPrefix) {
    return emptyIntentResult(rawQuery, taxonomy, {
      hasHashtagPrefix: true,
      taxonomyPenalty: 20,
      shortQueryPenalty: 0,
      multiWordDiscoveryBoost: 25,
    });
  }

  const normalizedQuery = normalizeDiscoverySearchQuery(rawQuery).trim();
  const scoringQuery = rawTrimmed;
  const comparable = stripAtPrefix(scoringQuery);
  let taxonomyMatch = matchQueryAgainstTaxonomy(scoringQuery, taxonomy);
  if (!taxonomyMatch.matchedTerms.length && normalizedQuery !== scoringQuery) {
    const normalizedMatch = matchQueryAgainstTaxonomy(normalizedQuery, taxonomy);
    if (normalizedMatch.level !== "none") {
      taxonomyMatch = normalizedMatch;
    }
  }

  const hasAtPrefix = scoringQuery.startsWith("@");
  const handlePatternScore = scoreHandlePattern(scoringQuery);
  const personNameScore = scorePersonName(scoringQuery, taxonomyMatch);
  const taxonomyPenalty = scoreTaxonomyPenalty(taxonomyMatch);
  const genericTermPenalty = scoreGenericTermPenalty(scoringQuery);
  const shortQueryPenalty = scoreShortQueryPenalty(comparable);
  const multiWordDiscoveryBoost = scoreMultiWordDiscoveryBoost(
    scoringQuery,
    taxonomyMatch,
    personNameScore,
    handlePatternScore
  );

  const tokenCount = comparable.split(/\s+/).filter(Boolean).length;
  const queryLength = comparable.length;

  let confidence =
    42 +
    handlePatternScore +
    personNameScore +
    (hasAtPrefix ? 8 : 0) -
    taxonomyPenalty -
    genericTermPenalty -
    shortQueryPenalty -
    multiWordDiscoveryBoost;

  if (taxonomyMatch.level === "full" || taxonomyMatch.level === "all_words") {
    confidence = Math.min(confidence, 58);
  }

  if (handlePatternScore > 0 && !hasAtPrefix && comparable.length < 8) {
    confidence = Math.min(confidence, 94);
  }

  if (hasAtPrefix && comparable.length < 8) {
    confidence = Math.min(confidence, 94);
  }

  confidence = clampConfidence(confidence);

  return {
    mode: resolveMode(confidence),
    confidence,
    signals: {
      rawQuery,
      normalizedQuery,
      tokenCount,
      queryLength,
      hasAtPrefix,
      hasHashtagPrefix,
      handlePatternScore,
      personNameScore,
      taxonomyMatch,
      taxonomyPenalty,
      genericTermPenalty,
      shortQueryPenalty,
      multiWordDiscoveryBoost,
    },
  };
}

function emptyIntentResult(
  rawQuery: string,
  taxonomy: DiscoverySearchTaxonomy,
  overrides: Partial<CreatorSearchIntentSignals> = {}
): CreatorSearchIntentResult {
  const taxonomyMatch = matchQueryAgainstTaxonomy(rawQuery, taxonomy);
  const signals: CreatorSearchIntentSignals = {
    rawQuery,
    normalizedQuery: "",
    tokenCount: 0,
    queryLength: 0,
    hasAtPrefix: false,
    hasHashtagPrefix: false,
    handlePatternScore: 0,
    personNameScore: 0,
    taxonomyMatch,
    taxonomyPenalty: scoreTaxonomyPenalty(taxonomyMatch),
    genericTermPenalty: 0,
    shortQueryPenalty: 60,
    multiWordDiscoveryBoost: 0,
    ...overrides,
  };

  const confidence = clampConfidence(
    42 -
      signals.taxonomyPenalty -
      signals.genericTermPenalty -
      signals.shortQueryPenalty -
      signals.multiWordDiscoveryBoost -
      (signals.hasHashtagPrefix ? 15 : 0)
  );

  return {
    mode: resolveMode(confidence),
    confidence,
    signals,
  };
}

/** Trim an exact-creator query to the first token for broader fuzzy discovery. */
export function simplifyCreatorSearchQuery(rawQuery: string): string {
  const query = normalizeDiscoverySearchQuery(rawQuery).trim();
  if (!query) return "";

  const withoutAt = stripAtPrefix(query);
  const firstToken = withoutAt.split(/[\s._-]+/).find((part) => part.length >= 2);
  return firstToken ?? withoutAt.split(/\s+/)[0] ?? "";
}

/** True when query token is a prefix of a normalized handle token. */
export function queryHasExactHandlePrefix(rawQuery: string): boolean {
  const token = normalizeDiscoveryTaxonomyWord(stripAtPrefix(normalizeDiscoverySearchQuery(rawQuery)));
  return token.length >= MIN_EXACT_CREATOR_QUERY_LENGTH && token.length <= 24;
}
