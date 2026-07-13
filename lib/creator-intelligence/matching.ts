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
  options: { categories?: string[]; topics?: string[]; languages?: string[] } = {}
): CampaignRequirements {
  const platforms = (facts?.platforms ?? [])
    .map((platform) => resolveDiscoveryPlatform(platform))
    .filter((platform): platform is NonNullable<typeof platform> => Boolean(platform));

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
    const country = ci.audience.primaryCountry.value;
    breakdown.push({
      dimension: "country",
      evaluation: country == null ? "unknown" : evaluation(country === requirements.country),
      reason:
        country == null
          ? "audience country unresolved"
          : country === requirements.country
            ? `audience in ${country}`
            : `audience in ${country}, campaign targets ${requirements.country}`,
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
