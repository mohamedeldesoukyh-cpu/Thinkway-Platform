import type {
  UnifiedCreatorBrowseFilters,
  UnifiedCreatorBrowseResult,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import {
  getCoverageThreshold,
} from "@/lib/discovery/control-center/discovery-control-policy";
import { getCachedDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";
import type { DiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-types";

export type DiscoveryCoverageLevel = "excellent" | "good" | "partial" | "insufficient";

export type DiscoveryCoverageIntent = {
  country?: string;
  categories?: string[];
  /** Creator niche tags from brief (skincare, vitamin c, etc.). */
  niches?: string[];
  platforms?: string[];
  /** NL audience descriptor (e.g. "Gen Z mothers"). */
  audience?: string;
  minFollowers?: number;
  maxFollowers?: number;
  /** Intent parser confidence 0–100 when available. */
  searchConfidence?: number;
};

export type DiscoveryCoverageEvaluation = {
  coverageScore: number;
  coverageLevel: DiscoveryCoverageLevel;
  missingReasons: string[];
  breakdown: {
    count: number;
    countryMatchRatio: number | null;
    categoryMatchRatio: number | null;
    platformMatchRatio: number | null;
    audienceMatchRatio: number | null;
    budgetCompatibleRatio: number | null;
    dnaCompletenessRatio: number;
    medianThinkwayScore: number | null;
    searchConfidence: number | null;
  };
};

export type DiscoveryCoverageConfig = {
  minCount: number;
  minDnaRatio: number;
  minCategoryRatio: number;
  minCountryRatio: number;
  minMedianScore: number;
  scoreThreshold: number;
};

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getDiscoveryCoverageConfig(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): DiscoveryCoverageConfig {
  const envThreshold = envNumber("DISCOVERY_COVERAGE_SCORE_THRESHOLD", -1);
  const scoreThreshold =
    envThreshold >= 0 ? envThreshold : getCoverageThreshold(settings);

  return {
    minCount: envNumber("DISCOVERY_COVERAGE_MIN_COUNT", 10),
    minDnaRatio: envNumber("DISCOVERY_COVERAGE_MIN_DNA_RATIO", 0.6),
    minCategoryRatio: envNumber("DISCOVERY_COVERAGE_MIN_CATEGORY_RATIO", 0.5),
    minCountryRatio: envNumber("DISCOVERY_COVERAGE_MIN_COUNTRY_RATIO", 0.7),
    minMedianScore: envNumber("DISCOVERY_COVERAGE_MIN_MEDIAN_SCORE", 40),
    scoreThreshold,
  };
}

export function isDiscoveryCoverageApifyFallbackEnabled(
  settings: DiscoveryControlSettings = getCachedDiscoveryControlSettings()
): boolean {
  const flag = process.env.DISCOVERY_COVERAGE_APIFY_FALLBACK?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "yes") return true;
  const releaseFlag = process.env.RELEASE_12_DB_FIRST?.trim().toLowerCase();
  if (releaseFlag === "false" || releaseFlag === "0") return false;
  return settings.discoverySource !== "platform_database_only";
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeCountry(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value.trim().toUpperCase();
}

function creatorCountry(creator: UnifiedCreatorResult): string | null {
  return normalizeCountry(creator.country_code ?? creator.estimated_country);
}

function creatorCategoryTokens(creator: UnifiedCreatorResult): Set<string> {
  const tokens = new Set<string>();
  for (const value of [
    ...creator.categories,
    ...(creator.browse_category_tags ?? []),
    ...(creator.audience_interests ?? []),
    creator.ai_category,
    creator.ai_niche,
  ]) {
    if (typeof value === "string" && value.trim()) {
      tokens.add(normalizeToken(value));
    }
  }
  return tokens;
}

function creatorPlatformKeys(creator: UnifiedCreatorResult): Set<string> {
  return new Set(creator.platforms.map((p) => normalizeToken(p.platform)));
}

function matchesCategoryIntent(creator: UnifiedCreatorResult, categories: string[]): boolean {
  if (categories.length === 0) return true;
  const tokens = creatorCategoryTokens(creator);
  return categories.some((category) => tokens.has(normalizeToken(category)));
}

function matchesCountryIntent(creator: UnifiedCreatorResult, country: string): boolean {
  const target = normalizeCountry(country);
  if (!target) return true;
  const creatorCode = creatorCountry(creator);
  return creatorCode === target;
}

function matchesPlatformIntent(creator: UnifiedCreatorResult, platforms: string[]): boolean {
  if (platforms.length === 0) return true;
  const keys = creatorPlatformKeys(creator);
  return platforms.some((platform) => keys.has(normalizeToken(platform)));
}

function audienceTokens(audience: string): string[] {
  return audience
    .split(/[\s,;/]+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2);
}

function matchesAudienceIntent(creator: UnifiedCreatorResult, audience: string): boolean {
  const tokens = audienceTokens(audience);
  if (tokens.length === 0) return true;

  const haystack = [
    creator.bio ?? "",
    creator.display_name,
    ...creator.categories,
    ...(creator.audience_interests ?? []),
    creator.ai_category ?? "",
    creator.ai_niche ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return tokens.some((token) => haystack.includes(token));
}

function followerCount(creator: UnifiedCreatorResult): number | null {
  return creator.metrics.followers.value;
}

function matchesBudgetIntent(
  creator: UnifiedCreatorResult,
  minFollowers?: number,
  maxFollowers?: number
): boolean {
  if (minFollowers == null && maxFollowers == null) return true;
  const followers = followerCount(creator);
  if (followers == null) return false;
  if (minFollowers != null && followers < minFollowers) return false;
  if (maxFollowers != null && followers > maxFollowers) return false;
  return true;
}

/** Proxy for DNA row / staging confidence until browse hydrates creator_dna directly. */
function hasDnaCompletenessProxy(creator: UnifiedCreatorResult): boolean {
  if (creator.dna_completeness != null && creator.dna_completeness >= 40) return true;
  if (creator.source_confidence >= 0.7) return true;
  if (creator.enrichment_status === "enriched" || creator.enrichment_status === "partial") {
    return true;
  }
  return creator.categories.length > 0 && creator.thinkway_score >= 40;
}

function ratio(matches: number, total: number): number | null {
  if (total === 0) return null;
  return matches / total;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function resolveCoverageLevel(score: number): DiscoveryCoverageLevel {
  if (score >= 90) return "excellent";
  if (score >= 80) return "good";
  if (score >= 50) return "partial";
  return "insufficient";
}

function weightedScore(parts: Array<{ weight: number; value: number | null; defaultValue?: number }>): number {
  let totalWeight = 0;
  let sum = 0;
  for (const part of parts) {
    const value = part.value ?? part.defaultValue ?? 100;
    totalWeight += part.weight;
    sum += part.weight * Math.max(0, Math.min(100, value));
  }
  if (totalWeight === 0) return 0;
  return Math.round(sum / totalWeight);
}

export function evaluateDiscoveryCoverage(
  result: Pick<UnifiedCreatorBrowseResult, "creators" | "total">,
  intent: DiscoveryCoverageIntent = {},
  config: DiscoveryCoverageConfig = getDiscoveryCoverageConfig()
): DiscoveryCoverageEvaluation {
  const creators = result.creators;
  const count = creators.length;
  const missingReasons: string[] = [];

  const countryMatches = intent.country
    ? creators.filter((creator) => matchesCountryIntent(creator, intent.country!)).length
    : null;
  const countryMatchRatio = intent.country ? ratio(countryMatches ?? 0, count) : null;

  const categoryMatches = intent.categories?.length
    ? creators.filter((creator) => matchesCategoryIntent(creator, intent.categories!)).length
    : null;
  const categoryMatchRatio = intent.categories?.length
    ? ratio(categoryMatches ?? 0, count)
    : null;

  const platformMatches = intent.platforms?.length
    ? creators.filter((creator) => matchesPlatformIntent(creator, intent.platforms!)).length
    : null;
  const platformMatchRatio = intent.platforms?.length ? ratio(platformMatches ?? 0, count) : null;

  const audienceMatches = intent.audience
    ? creators.filter((creator) => matchesAudienceIntent(creator, intent.audience!)).length
    : null;
  const audienceMatchRatio = intent.audience ? ratio(audienceMatches ?? 0, count) : null;

  const budgetMatches =
    intent.minFollowers != null || intent.maxFollowers != null
      ? creators.filter((creator) =>
          matchesBudgetIntent(creator, intent.minFollowers, intent.maxFollowers)
        ).length
      : null;
  const budgetCompatibleRatio =
    intent.minFollowers != null || intent.maxFollowers != null
      ? ratio(budgetMatches ?? 0, count)
      : null;

  const dnaMatches = creators.filter(hasDnaCompletenessProxy).length;
  const dnaCompletenessRatio = ratio(dnaMatches, count) ?? 0;

  const thinkwayScores = creators.map((creator) => creator.thinkway_score);
  const medianThinkwayScore = median(thinkwayScores);

  if (count === 0) {
    missingReasons.push("No creators matched in the operational database.");
  } else if (count < config.minCount) {
    missingReasons.push(
      `Creator count ${count} is below minimum ${config.minCount}.`
    );
  }

  if (countryMatchRatio != null && countryMatchRatio < config.minCountryRatio) {
    missingReasons.push(
      `Country alignment ${Math.round(countryMatchRatio * 100)}% below ${Math.round(config.minCountryRatio * 100)}% target.`
    );
  }

  if (categoryMatchRatio != null && categoryMatchRatio < config.minCategoryRatio) {
    missingReasons.push(
      `Category alignment ${Math.round(categoryMatchRatio * 100)}% below ${Math.round(config.minCategoryRatio * 100)}% target.`
    );
  }

  if (dnaCompletenessRatio < config.minDnaRatio) {
    missingReasons.push(
      `DNA completeness proxy ${Math.round(dnaCompletenessRatio * 100)}% below ${Math.round(config.minDnaRatio * 100)}% target.`
    );
  }

  if (medianThinkwayScore != null && medianThinkwayScore < config.minMedianScore) {
    missingReasons.push(
      `Median Thinkway Score ${Math.round(medianThinkwayScore)} below ${config.minMedianScore}.`
    );
  }

  if (platformMatchRatio != null && platformMatchRatio < 0.5) {
    missingReasons.push("Less than half of matches are on requested platforms.");
  }

  if (audienceMatchRatio != null && audienceMatchRatio < 0.4) {
    missingReasons.push("Audience descriptor overlap is weak across matches.");
  }

  if (budgetCompatibleRatio != null && budgetCompatibleRatio < 0.5) {
    missingReasons.push("Less than half of matches fit follower budget constraints.");
  }

  const countScore = count === 0 ? 0 : Math.min(100, (count / config.minCount) * 100);

  const coverageScore = weightedScore([
    { weight: 25, value: countScore },
    { weight: 15, value: countryMatchRatio != null ? countryMatchRatio * 100 : null, defaultValue: 100 },
    { weight: 15, value: categoryMatchRatio != null ? categoryMatchRatio * 100 : null, defaultValue: 100 },
    { weight: 10, value: platformMatchRatio != null ? platformMatchRatio * 100 : null, defaultValue: 100 },
    { weight: 10, value: audienceMatchRatio != null ? audienceMatchRatio * 100 : null, defaultValue: 100 },
    { weight: 10, value: budgetCompatibleRatio != null ? budgetCompatibleRatio * 100 : null, defaultValue: 100 },
    { weight: 10, value: dnaCompletenessRatio * 100 },
    {
      weight: 10,
      value:
        medianThinkwayScore == null
          ? null
          : Math.min(100, (medianThinkwayScore / config.minMedianScore) * 100),
      defaultValue: 50,
    },
    {
      weight: 5,
      value: intent.searchConfidence ?? null,
      defaultValue: 70,
    },
  ]);

  let coverageLevel = resolveCoverageLevel(coverageScore);
  if (count === 0) {
    coverageLevel = "insufficient";
  } else if (
    coverageLevel !== "insufficient" &&
    (count < config.minCount ||
      (countryMatchRatio != null && countryMatchRatio < config.minCountryRatio) ||
      (categoryMatchRatio != null && categoryMatchRatio < config.minCategoryRatio) ||
      dnaCompletenessRatio < config.minDnaRatio)
  ) {
    coverageLevel = coverageScore >= config.scoreThreshold ? "partial" : "insufficient";
  }

  return {
    coverageScore,
    coverageLevel,
    missingReasons,
    breakdown: {
      count,
      countryMatchRatio,
      categoryMatchRatio,
      platformMatchRatio,
      audienceMatchRatio,
      budgetCompatibleRatio,
      dnaCompletenessRatio,
      medianThinkwayScore,
      searchConfidence: intent.searchConfidence ?? null,
    },
  };
}

export function coverageMeetsThreshold(
  evaluation: DiscoveryCoverageEvaluation,
  config: DiscoveryCoverageConfig = getDiscoveryCoverageConfig()
): boolean {
  return evaluation.coverageScore >= config.scoreThreshold;
}

export function coverageIntentFromBrowseFilters(
  filters: UnifiedCreatorBrowseFilters,
  extras?: Partial<DiscoveryCoverageIntent>
): DiscoveryCoverageIntent {
  return {
    country: filters.country ?? extras?.country,
    categories: filters.categories ?? (filters.category ? [filters.category] : extras?.categories),
    platforms: filters.platforms ?? (filters.platform ? [filters.platform] : extras?.platforms),
    minFollowers: filters.minFollowers ?? extras?.minFollowers,
    maxFollowers: filters.maxFollowers ?? extras?.maxFollowers,
    audience: extras?.audience,
    searchConfidence: extras?.searchConfidence,
  };
}
