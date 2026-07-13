/**
 * Matching Engine — the ONLY place campaign requirements meet creator
 * capabilities.
 *
 * Campaign Intelligence (CampaignFacts) is adapted into CampaignRequirements;
 * Creator Intelligence profiles are evaluated per dimension with explicit
 * match / no_match / unknown outcomes. Unknown data is discounted, never
 * treated as a silent pass or a hard fail — reusing the exact semantics the
 * campaign-relevance scorer already established
 * (UNKNOWN_CRITERION_WEIGHT_DISCOUNT).
 *
 * Consumers (Discovery browse, Ranking, Studio slate proposal, Director,
 * Outputs) take the scored matches; they must not re-implement their own
 * campaign×creator comparisons.
 */
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { normalizeInfluencerTier } from "@/lib/creators/influencer-tier";
import { UNKNOWN_CRITERION_WEIGHT_DISCOUNT } from "@/lib/discovery/campaign-relevance-scoring";

import {
  categoriesIntersect,
  meetsBrandSafetyMinimum,
  resolveCanonicalCategories,
  resolveCountryCode,
  resolveDiscoveryPlatform,
  resolveLanguageCodes,
  resolveTopics,
} from "./taxonomy";
import type {
  CampaignRequirements,
  CreatorIntelligence,
  CreatorMatch,
  CreatorMatchBreakdown,
  MatchEvaluation,
} from "./types";

/**
 * Adapt Campaign Intelligence (facts SSOT) into matching requirements.
 * Categories/topics are not stored on facts — callers pass them from the
 * campaign search intent so this layer never re-parses briefs.
 */
export function campaignRequirementsFromFacts(
  facts: CampaignFacts | undefined,
  options: {
    categories?: string[];
    topics?: string[];
    languages?: string[];
    /** Tier labels from the campaign creator mix (e.g. buildCreatorMixFromFacts). */
    creatorTypes?: string[];
  } = {}
): CampaignRequirements {
  const platforms = (facts?.platforms ?? [])
    .map((platform) => resolveDiscoveryPlatform(platform))
    .filter((platform): platform is NonNullable<typeof platform> => Boolean(platform));

  const creatorTypes = (options.creatorTypes ?? [])
    .map((tier) => normalizeInfluencerTier(tier))
    .filter((tier): tier is NonNullable<typeof tier> => Boolean(tier));

  return {
    platforms: platforms.length > 0 ? platforms : undefined,
    country: resolveCountryCode(facts?.geography?.[0]) || undefined,
    categories: options.categories?.length
      ? resolveCanonicalCategories(options.categories)
      : undefined,
    topics: options.topics?.length ? resolveTopics(options.topics) : undefined,
    languages: options.languages?.length
      ? resolveLanguageCodes(options.languages)
      : undefined,
    creatorTypes: creatorTypes.length > 0 ? creatorTypes : undefined,
  };
}

function evaluation(matched: boolean): MatchEvaluation {
  return matched ? "match" : "no_match";
}

function evaluateDimensions(
  requirements: CampaignRequirements,
  ci: CreatorIntelligence
): CreatorMatchBreakdown[] {
  const breakdown: CreatorMatchBreakdown[] = [];

  if (requirements.platforms?.length) {
    const matched = ci.platforms.some((platform) => requirements.platforms!.includes(platform));
    breakdown.push({
      dimension: "platform",
      evaluation: ci.platforms.length === 0 ? "unknown" : evaluation(matched),
      reason: matched
        ? `active on ${requirements.platforms.join("/")}`
        : ci.platforms.length === 0
          ? "no platform accounts resolved"
          : `platforms ${ci.platforms.join(", ")} do not include ${requirements.platforms.join("/")}`,
    });
  }

  if (requirements.country) {
    // Audience-country intelligence: primary country plus demographics top-countries.
    const audienceCountries = new Set(
      [ci.audience.primaryCountry.value, ...ci.audience.countries.value].filter(
        (code): code is string => Boolean(code)
      )
    );
    const matched = audienceCountries.has(requirements.country);
    breakdown.push({
      dimension: "country",
      evaluation: audienceCountries.size === 0 ? "unknown" : evaluation(matched),
      reason:
        audienceCountries.size === 0
          ? "audience country unresolved"
          : matched
            ? `audience in ${requirements.country}`
            : `audience in ${[...audienceCountries].join("/")}, campaign targets ${requirements.country}`,
    });
  }

  if (requirements.categories?.length) {
    const categories = ci.categories.value;
    breakdown.push({
      dimension: "category",
      evaluation:
        categories.length === 0
          ? "unknown"
          : evaluation(categoriesIntersect(categories, requirements.categories)),
      reason:
        categories.length === 0
          ? `categories unresolved (${ci.categories.source})`
          : categoriesIntersect(categories, requirements.categories)
            ? `matches ${categories.filter((c) => requirements.categories!.includes(c)).join(", ") || "requested categories"}`
            : `categories [${categories.join(", ")}] miss [${requirements.categories.join(", ")}]`,
    });
  }

  if (requirements.topics?.length) {
    const topics = new Set(ci.topics.value);
    const hit = requirements.topics.find((topic) => topics.has(topic));
    breakdown.push({
      dimension: "topic",
      evaluation: ci.topics.value.length === 0 ? "unknown" : evaluation(Boolean(hit)),
      reason: hit
        ? `topic "${hit}"`
        : ci.topics.value.length === 0
          ? "topics unresolved"
          : "no requested topic present",
    });
  }

  if (requirements.languages?.length) {
    const languages = new Set(ci.languages.value);
    const hit = requirements.languages.find((language) => languages.has(language));
    breakdown.push({
      dimension: "language",
      evaluation: ci.languages.value.length === 0 ? "unknown" : evaluation(Boolean(hit)),
      reason: hit
        ? `speaks ${hit}`
        : ci.languages.value.length === 0
          ? "languages unresolved"
          : `languages [${ci.languages.value.join(", ")}] miss [${requirements.languages.join(", ")}]`,
    });
  }

  if (requirements.creatorTypes?.length) {
    const tier = ci.creatorType.value;
    const matched = tier != null && requirements.creatorTypes.includes(tier);
    breakdown.push({
      dimension: "creator_type",
      evaluation: tier == null ? "unknown" : evaluation(matched),
      reason:
        tier == null
          ? "creator tier unresolved"
          : matched
            ? `${tier} tier fits mix [${requirements.creatorTypes.join(", ")}]`
            : `${tier} tier outside mix [${requirements.creatorTypes.join(", ")}]`,
    });
  }

  if (requirements.audienceAgeBuckets?.length) {
    const bucket = ci.audience.dominantAgeBucket.value;
    const matched = bucket != null && requirements.audienceAgeBuckets.includes(bucket);
    breakdown.push({
      dimension: "audience_age",
      evaluation: bucket == null ? "unknown" : evaluation(matched),
      reason:
        bucket == null
          ? "audience age unresolved"
          : matched
            ? `dominant audience age ${bucket}`
            : `dominant audience age ${bucket} outside target`,
    });
  }

  if (requirements.audienceGender) {
    const split = ci.audience.genderSplit.value;
    const share = split ? split[requirements.audienceGender] : null;
    const matched = share != null && share >= 50;
    breakdown.push({
      dimension: "audience_gender",
      evaluation: split == null ? "unknown" : evaluation(matched),
      reason:
        split == null
          ? "audience gender unresolved"
          : matched
            ? `${requirements.audienceGender} audience ${share}%`
            : `${requirements.audienceGender} audience ${share ?? 0}% below 50%`,
    });
  }

  if (requirements.minFollowers != null || requirements.maxFollowers != null) {
    const followers = ci.metrics.maxFollowers;
    const matched =
      followers != null &&
      (requirements.minFollowers == null || followers >= requirements.minFollowers) &&
      (requirements.maxFollowers == null || followers <= requirements.maxFollowers);
    breakdown.push({
      dimension: "followers",
      evaluation: followers == null ? "unknown" : evaluation(matched),
      reason:
        followers == null
          ? "follower count unresolved"
          : matched
            ? `${followers.toLocaleString()} followers in range`
            : `${followers.toLocaleString()} followers outside range`,
    });
  }

  if (requirements.minEngagementRate != null) {
    const engagement = ci.metrics.maxEngagementRate;
    const matched = engagement != null && engagement >= requirements.minEngagementRate;
    breakdown.push({
      dimension: "engagement",
      evaluation: engagement == null ? "unknown" : evaluation(matched),
      reason:
        engagement == null
          ? "engagement unresolved"
          : matched
            ? `engagement ${engagement}%`
            : `engagement ${engagement}% below ${requirements.minEngagementRate}%`,
    });
  }

  if (requirements.brandSafetyMinimum) {
    const level = ci.brandSafety.level.value;
    breakdown.push({
      dimension: "brand_safety",
      evaluation:
        level === "unknown"
          ? "unknown"
          : evaluation(meetsBrandSafetyMinimum(level, requirements.brandSafetyMinimum)),
      reason:
        level === "unknown"
          ? "brand safety unresolved"
          : `brand safety ${level} vs minimum ${requirements.brandSafetyMinimum}`,
    });
  }

  return breakdown;
}

/**
 * Match one creator against campaign requirements.
 * score = matched / (known + discount × unknown) × 100; empty requirements → 100.
 */
export function matchCreatorToCampaign(
  requirements: CampaignRequirements,
  intelligence: CreatorIntelligence
): CreatorMatch {
  const breakdown = evaluateDimensions(requirements, intelligence);

  const matched = breakdown.filter((b) => b.evaluation === "match").length;
  const missed = breakdown.filter((b) => b.evaluation === "no_match").length;
  const unknown = breakdown.filter((b) => b.evaluation === "unknown").length;
  const known = matched + missed;
  const denominator = known + UNKNOWN_CRITERION_WEIGHT_DISCOUNT * unknown;

  const score = breakdown.length === 0 || denominator === 0
    ? 100
    : Math.round((matched / denominator) * 100);

  return {
    unifiedId: intelligence.unifiedId,
    score,
    eligible: missed === 0,
    breakdown,
    intelligence,
  };
}

/** Match a pool; sorted by score desc, then thinkway score desc. */
export function matchCreatorsToCampaign(
  requirements: CampaignRequirements,
  intelligences: ReadonlyArray<CreatorIntelligence>
): CreatorMatch[] {
  return intelligences
    .map((ci) => matchCreatorToCampaign(requirements, ci))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.intelligence.scores.thinkway ?? 0) - (a.intelligence.scores.thinkway ?? 0)
    );
}
