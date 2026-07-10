import {
  creatorBrowseCategoryTags,
  creatorMatchesBrowseCategories,
} from "@/lib/creators/category-filter";
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

/**
 * Tri-state criterion outcome. `unknown` means the creator has NO data for the
 * field group (unenriched), which must discount relevance rather than count as
 * a proven mismatch — otherwise ranking rewards database completeness over fit.
 */
export type CriterionEvaluation = "match" | "no_match" | "unknown";

/**
 * Unknown data costs half a mismatch: score = matched / (known + 0.5 × unknown).
 * A sparse creator is discounted for what we can't verify, never disqualified by it.
 */
export const UNKNOWN_CRITERION_WEIGHT_DISCOUNT = 0.5;

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
  /** Weight of criteria the creator has data for (match + no_match). */
  knownWeight: number;
  /** Weight of criteria with no underlying creator data. */
  unknownWeight: number;
  unknownCount: number;
};

function toEvaluation(matched: boolean): CriterionEvaluation {
  return matched ? "match" : "no_match";
}

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

/** Content intelligence beyond name/handle — absence means text criteria are unverifiable. */
function hasContentSignal(creator: UnifiedCreatorResult): boolean {
  return Boolean(
    creator.bio?.trim() ||
      creator.ai_category?.trim() ||
      creator.ai_niche?.trim() ||
      (creator.audience_interests?.length ?? 0) > 0 ||
      creator.categories.length > 0 ||
      (creator.browse_category_tags?.length ?? 0) > 0 ||
      (creator.hashtags?.length ?? 0) > 0
  );
}

function demographicsAvailable(creator: UnifiedCreatorResult): boolean {
  return Boolean(
    creator.audience_demographics && creator.audience_demographics.source !== "unavailable"
  );
}

function evaluateCountry(creator: UnifiedCreatorResult, code: string): CriterionEvaluation {
  const target = normalizeCountryCode(code);
  if (!target) return "unknown";

  const codes = creatorCountryCodes(creator);
  if (codes.includes(target)) return "match";

  if (demographicsAvailable(creator)) {
    const filter = audienceFilterFromSearchFields({ audienceCountry: target });
    if (matchesAudienceFilter(creator.audience_demographics!, filter)) return "match";
  }

  const hasGeoSignal = codes.length > 0 || demographicsAvailable(creator);
  return hasGeoSignal ? "no_match" : "unknown";
}

function evaluateNicheOrTag(creator: UnifiedCreatorResult, tag: string): CriterionEvaluation {
  const needle = tag.trim().toLowerCase().replace(/^#/, "");
  if (!needle) return "unknown";
  if (haystackText(creator).includes(needle)) return "match";
  return hasContentSignal(creator) ? "no_match" : "unknown";
}

function evaluateCategory(creator: UnifiedCreatorResult, value: string): CriterionEvaluation {
  if (creatorMatchesBrowseCategories(creator, [value])) return "match";
  const hasCategorySignal =
    creatorBrowseCategoryTags(creator).length > 0 ||
    (creator.audience_interests?.length ?? 0) > 0;
  return hasCategorySignal ? "no_match" : "unknown";
}

function evaluatePlatform(creator: UnifiedCreatorResult, platform: string): CriterionEvaluation {
  if (creator.platforms.length === 0) return "unknown";
  const target = platform.trim().toLowerCase();
  return toEvaluation(creator.platforms.some((p) => p.platform.toLowerCase() === target));
}

function evaluateLanguage(creator: UnifiedCreatorResult, language: string): CriterionEvaluation {
  const needle = language.trim().toLowerCase();
  if (!needle) return "unknown";
  if (creator.language_codes.length === 0) return "unknown";
  return toEvaluation(creator.language_codes.some((code) => code.toLowerCase().includes(needle)));
}

function creatorFollowerValue(creator: UnifiedCreatorResult): number | null {
  return creator.metrics.followers.value ?? creator.platforms[0]?.follower_count ?? null;
}

function evaluateFollowerMin(creator: UnifiedCreatorResult, min: string): CriterionEvaluation {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return "unknown";
  const followers = creatorFollowerValue(creator);
  if (followers == null) return "unknown";
  return toEvaluation(followers >= threshold);
}

function evaluateFollowerMax(creator: UnifiedCreatorResult, max: string): CriterionEvaluation {
  const threshold = Number(max);
  if (Number.isNaN(threshold)) return "unknown";
  const followers = creatorFollowerValue(creator);
  if (followers == null) return "unknown";
  return toEvaluation(followers <= threshold);
}

function evaluateEngagementMin(creator: UnifiedCreatorResult, min: string): CriterionEvaluation {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return "unknown";
  const rate =
    creator.metrics.engagement_rate.value ?? creator.platforms[0]?.engagement_rate ?? null;
  if (rate == null) return "unknown";
  return toEvaluation(rate >= threshold);
}

function evaluateBrandSafetyMin(creator: UnifiedCreatorResult, min: string): CriterionEvaluation {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return "unknown";
  const score = creator.authenticity_score ?? creator.brand_fit_score ?? null;
  if (score == null) return "unknown";
  return toEvaluation(score >= threshold);
}

/**
 * Brand fit uses brand_fit_score ONLY. The legacy fallback to thinkway_score is
 * intentionally removed: thinkway_score measures data quality, not brand fit,
 * and the fallback leaked completeness into fit ranking.
 */
function evaluateBrandFitMin(creator: UnifiedCreatorResult, min: string): CriterionEvaluation {
  const threshold = Number(min);
  if (Number.isNaN(threshold)) return "unknown";
  if (creator.brand_fit_score == null) return "unknown";
  return toEvaluation(creator.brand_fit_score >= threshold);
}

function evaluateAudienceDemographics(
  creator: UnifiedCreatorResult,
  fields: {
    gender?: string;
    ageMin?: string;
    ageMax?: string;
  }
): CriterionEvaluation {
  const filter = audienceFilterFromSearchFields({
    gender: fields.gender,
    ageMin: fields.ageMin,
    ageMax: fields.ageMax,
  });
  if (!hasAnyAudienceFilter(filter)) return "match";
  if (!demographicsAvailable(creator)) return "unknown";
  return toEvaluation(matchesAudienceFilter(creator.audience_demographics!, filter));
}

function criterionRawValue(criterion: CampaignSearchCriterion): string {
  const raw = criterion.meta?.rawValue;
  return raw != null ? String(raw) : criterion.value.trim();
}

function evaluateCriterion(
  creator: UnifiedCreatorResult,
  criterion: CampaignSearchCriterion
): CriterionEvaluation {
  const key = criterion.meta?.discoveryKey as DiscoverySearchFilterKey | undefined;
  const value = criterionRawValue(criterion);
  if (!value) return "unknown";

  if (key) {
    switch (key) {
      case "category":
        return evaluateCategory(creator, value);
      case "niche":
      case "content_tag":
      case "content_keyword":
        return evaluateNicheOrTag(creator, value);
      case "creator_country":
      case "creator_city":
      case "audience_country":
      case "audience_city":
        return evaluateCountry(creator, value);
      case "creator_gender":
      case "audience_gender":
        return evaluateAudienceDemographics(creator, { gender: value.toLowerCase() });
      case "creator_age_min":
      case "audience_age_min":
        return evaluateAudienceDemographics(creator, { ageMin: value });
      case "creator_age_max":
      case "audience_age_max":
        return evaluateAudienceDemographics(creator, { ageMax: value });
      case "language":
        return evaluateLanguage(creator, value);
      case "platform":
        return evaluatePlatform(creator, value);
      case "follower_min":
        return evaluateFollowerMin(creator, value);
      case "follower_max":
        return evaluateFollowerMax(creator, value);
      case "engagement_min":
        return evaluateEngagementMin(creator, value);
      case "brand_safety_min":
        return evaluateBrandSafetyMin(creator, value);
      case "brand_fit_min":
        return evaluateBrandFitMin(creator, value);
      case "engagement_max":
      case "verified":
        return "match";
      default:
        break;
    }
  }

  switch (criterion.kind) {
    case "category":
      return evaluateCategory(creator, value);
    case "niche":
      return evaluateNicheOrTag(creator, value);
    case "country":
    case "city":
      return evaluateCountry(creator, value);
    case "platform":
      return evaluatePlatform(creator, value);
    case "language":
      return evaluateLanguage(creator, value);
    case "engagement":
      return evaluateEngagementMin(creator, value);
    case "brand_fit":
    case "authenticity":
      return evaluateBrandSafetyMin(creator, value);
    case "luxury":
      return evaluateBrandFitMin(creator, value);
    case "audience":
      if (/^\d+$/.test(value)) {
        return evaluateAudienceDemographics(creator, { ageMin: value });
      }
      return evaluateAudienceDemographics(creator, { gender: value.toLowerCase() });
    default:
      return evaluateNicheOrTag(creator, value);
  }
}

function criterionWeight(criterion: CampaignSearchCriterion): number {
  const weight = criterion.weight;
  if (typeof weight === "number" && weight > 0) return weight;
  return 1;
}

/**
 * Weighted partial-match score for one creator against campaign criteria (0–100).
 * Criteria the creator has no data for count at UNKNOWN_CRITERION_WEIGHT_DISCOUNT
 * of a mismatch, so fit ranking never punishes sparse enrichment as if it were
 * a proven mismatch (and never rewards it as a match).
 */
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
      knownWeight: 0,
      unknownWeight: 0,
      unknownCount: 0,
    };
  }

  let matchedWeight = 0;
  let totalWeight = 0;
  let matchedCount = 0;
  let knownWeight = 0;
  let unknownWeight = 0;
  let unknownCount = 0;

  for (const criterion of enabled) {
    const weight = criterionWeight(criterion);
    totalWeight += weight;
    const evaluation = evaluateCriterion(creator, criterion);
    if (evaluation === "match") {
      matchedWeight += weight;
      matchedCount += 1;
      knownWeight += weight;
    } else if (evaluation === "no_match") {
      knownWeight += weight;
    } else {
      unknownWeight += weight;
      unknownCount += 1;
    }
  }

  const effectiveWeight =
    knownWeight + UNKNOWN_CRITERION_WEIGHT_DISCOUNT * unknownWeight;
  const score =
    effectiveWeight > 0 ? Math.round((matchedWeight / effectiveWeight) * 100) : 0;

  return {
    score,
    matchedWeight,
    totalWeight,
    matchedCount,
    criterionCount: enabled.length,
    knownWeight,
    unknownWeight,
    unknownCount,
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
