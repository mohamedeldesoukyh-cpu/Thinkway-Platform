import { creatorMatchesBrowseCategories } from "@/lib/creators/category-filter";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import type { DiscoverySearchFilterKey } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import {
  audienceFilterFromSearchFields,
  hasAnyAudienceFilter,
  matchesAudienceFilter,
} from "@/features/discovery/enrichment/audience-filters";

/** Minimum relevance % when explicitly filtering (optional). AI search shows all scored creators. */
export const CAMPAIGN_RELEVANCE_MIN_SCORE = 15;

/** When filtering by min score and none qualify, return up to this many best partial matches. */
export const CAMPAIGN_RELEVANCE_FALLBACK_TOP_N = 30;

/** True when AI campaign search is active with at least one enabled strategy criterion. */
export function isCampaignRelevanceSearchActive(
  aiModeActive: boolean,
  criteria: CampaignSearchCriterion[]
): boolean {
  return aiModeActive && criteria.some((c) => c.enabled && c.value.trim());
}

export type RankCreatorsByCampaignRelevanceOptions = {
  /** When set, drop creators below this score unless none qualify (fallback top N). */
  minScore?: number;
};

export type CampaignRelevanceBreakdown = {
  score: number;
  matchedWeight: number;
  totalWeight: number;
  matchedCount: number;
  criterionCount: number;
};

function normalizeCountryCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function creatorCountryCodes(creator: UnifiedCreatorResult): string[] {
  const codes = new Set<string>();
  const primary = normalizeCountryCode(creator.country_code ?? creator.estimated_country);
  if (primary) codes.add(primary);
  for (const platform of creator.platforms) {
    const audience = normalizeCountryCode(platform.audience_country);
    if (audience) codes.add(audience);
  }
  return [...codes];
}

function haystackText(creator: UnifiedCreatorResult): string {
  return [
    creator.display_name,
    creator.bio,
    creator.ai_category,
    creator.ai_niche,
    ...(creator.audience_interests ?? []),
    ...creator.categories,
    ...(creator.browse_category_tags ?? []),
    ...(creator.hashtags ?? []),
    creator.platforms.map((p) => p.handle).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesCountry(creator: UnifiedCreatorResult, code: string): boolean {
  const target = normalizeCountryCode(code);
  if (!target) return false;
  if (creatorCountryCodes(creator).includes(target)) return true;

  const demographics = creator.audience_demographics;
  if (demographics && demographics.source !== "unavailable") {
    const filter = audienceFilterFromSearchFields({ audienceCountry: target });
    if (matchesAudienceFilter(demographics, filter)) return true;
  }

  return creator.platforms.some(
    (platform) => normalizeCountryCode(platform.audience_country) === target
  );
}

function matchesNicheOrTag(creator: UnifiedCreatorResult, tag: string): boolean {
  const needle = tag.trim().toLowerCase().replace(/^#/, "");
  if (!needle) return false;
  return haystackText(creator).includes(needle);
}

function matchesPlatform(creator: UnifiedCreatorResult, platform: string): boolean {
  const target = platform.trim().toLowerCase();
  return creator.platforms.some((p) => p.platform.toLowerCase() === target);
}

function matchesLanguage(creator: UnifiedCreatorResult, language: string): boolean {
  const needle = language.trim().toLowerCase();
  if (!needle) return false;
  return creator.language_codes.some((code) => code.toLowerCase().includes(needle));
}

function matchesFollowerMin(creator: UnifiedCreatorResult, min: string): boolean {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return false;
  const followers = creator.metrics.followers.value ?? creator.platforms[0]?.follower_count ?? 0;
  return followers >= threshold;
}

function matchesFollowerMax(creator: UnifiedCreatorResult, max: string): boolean {
  const threshold = Number(max);
  if (Number.isNaN(threshold)) return false;
  const followers = creator.metrics.followers.value ?? creator.platforms[0]?.follower_count ?? 0;
  return followers <= threshold;
}

function matchesEngagementMin(creator: UnifiedCreatorResult, min: string): boolean {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return false;
  const rate = creator.metrics.engagement_rate.value ?? creator.platforms[0]?.engagement_rate ?? 0;
  return rate >= threshold;
}

function matchesBrandSafetyMin(creator: UnifiedCreatorResult, min: string): boolean {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return false;
  const score = creator.authenticity_score ?? creator.brand_fit_score ?? 0;
  return score >= threshold;
}

function matchesBrandFitMin(creator: UnifiedCreatorResult, min: string): boolean {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return false;
  return (creator.brand_fit_score ?? creator.thinkway_score ?? 0) >= threshold;
}

function matchesAudienceDemographics(
  creator: UnifiedCreatorResult,
  fields: {
    gender?: string;
    ageMin?: string;
    ageMax?: string;
  }
): boolean {
  const filter = audienceFilterFromSearchFields({
    gender: fields.gender,
    ageMin: fields.ageMin,
    ageMax: fields.ageMax,
  });
  if (!hasAnyAudienceFilter(filter)) return true;
  const demographics = creator.audience_demographics;
  if (!demographics || demographics.source === "unavailable") return false;
  return matchesAudienceFilter(demographics, filter);
}

function criterionRawValue(criterion: CampaignSearchCriterion): string {
  const raw = criterion.meta?.rawValue;
  return raw != null ? String(raw) : criterion.value.trim();
}

function criterionMatches(
  creator: UnifiedCreatorResult,
  criterion: CampaignSearchCriterion
): boolean {
  const key = criterion.meta?.discoveryKey as DiscoverySearchFilterKey | undefined;
  const value = criterionRawValue(criterion);
  if (!value) return false;

  if (key) {
    switch (key) {
      case "category":
        return creatorMatchesBrowseCategories(creator, [value]);
      case "niche":
      case "content_tag":
      case "content_keyword":
        return matchesNicheOrTag(creator, value);
      case "creator_country":
      case "creator_city":
      case "audience_country":
      case "audience_city":
        return matchesCountry(creator, value);
      case "creator_gender":
      case "audience_gender":
        return matchesAudienceDemographics(creator, { gender: value.toLowerCase() });
      case "creator_age_min":
      case "audience_age_min":
        return matchesAudienceDemographics(creator, { ageMin: value });
      case "creator_age_max":
      case "audience_age_max":
        return matchesAudienceDemographics(creator, { ageMax: value });
      case "language":
        return matchesLanguage(creator, value);
      case "platform":
        return matchesPlatform(creator, value);
      case "follower_min":
        return matchesFollowerMin(creator, value);
      case "follower_max":
        return matchesFollowerMax(creator, value);
      case "engagement_min":
        return matchesEngagementMin(creator, value);
      case "brand_safety_min":
        return matchesBrandSafetyMin(creator, value);
      case "brand_fit_min":
        return matchesBrandFitMin(creator, value);
      case "engagement_max":
      case "verified":
        return true;
      default:
        break;
    }
  }

  switch (criterion.kind) {
    case "category":
      return creatorMatchesBrowseCategories(creator, [value]);
    case "niche":
      return matchesNicheOrTag(creator, value);
    case "country":
    case "city":
      return matchesCountry(creator, value);
    case "platform":
      return matchesPlatform(creator, value);
    case "language":
      return matchesLanguage(creator, value);
    case "engagement":
      return matchesEngagementMin(creator, value);
    case "brand_fit":
    case "authenticity":
      return matchesBrandSafetyMin(creator, value);
    case "luxury":
      return matchesBrandFitMin(creator, value);
    case "audience":
      if (/^\d+$/.test(value)) {
        return matchesAudienceDemographics(creator, { ageMin: value });
      }
      return matchesAudienceDemographics(creator, { gender: value.toLowerCase() });
    default:
      return matchesNicheOrTag(creator, value);
  }
}

function criterionWeight(criterion: CampaignSearchCriterion): number {
  const weight = criterion.weight;
  if (typeof weight === "number" && weight > 0) return weight;
  return 1;
}

/** Weighted partial-match score for one creator against campaign criteria (0–100). */
export function scoreCreatorCampaignRelevance(
  creator: UnifiedCreatorResult,
  criteria: CampaignSearchCriterion[]
): CampaignRelevanceBreakdown {
  const enabled = criteria.filter((c) => c.enabled && c.value.trim());
  if (enabled.length === 0) {
    return {
      score: 100,
      matchedWeight: 0,
      totalWeight: 0,
      matchedCount: 0,
      criterionCount: 0,
    };
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  let matchedCount = 0;

  for (const criterion of enabled) {
    const weight = criterionWeight(criterion);
    totalWeight += weight;
    if (criterionMatches(creator, criterion)) {
      matchedWeight += weight;
      matchedCount += 1;
    }
  }

  const score =
    totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 0;

  return {
    score,
    matchedWeight,
    totalWeight,
    matchedCount,
    criterionCount: enabled.length,
  };
}

/**
 * Attach campaign relevance scores without reordering (client sort owns order).
 */
export function attachCampaignRelevanceScores(
  creators: UnifiedCreatorResult[],
  criteria: CampaignSearchCriterion[]
): UnifiedCreatorResult[] {
  if (creators.length === 0) return [];

  const enabled = criteria.filter((c) => c.enabled && c.value.trim());
  if (enabled.length === 0) return creators;

  return creators.map((creator) => {
    const breakdown = scoreCreatorCampaignRelevance(creator, enabled);
    return {
      ...creator,
      campaign_relevance_score: breakdown.score,
    };
  });
}

/**
 * Score and sort by campaign relevance (optional min-score filter).
 */
export function rankCreatorsByCampaignRelevance(
  creators: UnifiedCreatorResult[],
  criteria: CampaignSearchCriterion[],
  options?: RankCreatorsByCampaignRelevanceOptions
): UnifiedCreatorResult[] {
  if (creators.length === 0) return [];

  const scored = attachCampaignRelevanceScores(creators, criteria);
  const enabled = criteria.filter((c) => c.enabled && c.value.trim());
  if (enabled.length === 0) return scored;

  scored.sort(
    (a, b) =>
      (b.campaign_relevance_score ?? 0) - (a.campaign_relevance_score ?? 0) ||
      (b.thinkway_score ?? 0) - (a.thinkway_score ?? 0)
  );

  const minScore = options?.minScore;
  if (minScore == null) {
    return scored;
  }

  const aboveMin = scored.filter(
    (c) => (c.campaign_relevance_score ?? 0) >= minScore
  );
  if (aboveMin.length > 0) return aboveMin;

  return scored.slice(0, CAMPAIGN_RELEVANCE_FALLBACK_TOP_N);
}
