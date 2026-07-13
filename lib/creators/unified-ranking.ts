import { getCreatorIntelligenceMode } from "@/lib/creator-intelligence/flags";
import { resolveCreatorIntelligence } from "@/lib/creator-intelligence/resolver";
import { categoriesIntersect } from "@/lib/creator-intelligence/taxonomy";
import type { DiscoveryCoverageIntent } from "@/lib/creators/discovery-coverage";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function audienceOverlapScore(creator: UnifiedCreatorResult, audience?: string): number {
  if (!audience?.trim()) return 0.5;
  const tokens = audience
    .split(/[\s,;/]+/)
    .map(normalizeToken)
    .filter((token) => token.length > 2);
  if (tokens.length === 0) return 0.5;

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

  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return Math.min(1, hits / tokens.length);
}

/**
 * Creator-Intelligence category score — replaces the legacy stored-tag read in
 * CREATOR_INTELLIGENCE_MODE=on. Ranks on RESOLVED intelligence (never crawl
 * provenance): full canonical intersection scores 1; niche/topic partial
 * overlap scores 0.6; resolved-but-mismatched 0.15; unresolved 0.4 (an
 * enrichment gap, softer than a proven mismatch — mirrors unknown-discount).
 */
function intelligenceCategoryScore(
  creator: UnifiedCreatorResult,
  intentCategories: string[]
): number {
  const intelligence = resolveCreatorIntelligence(creator);
  const resolved = intelligence.categories.value;
  if (categoriesIntersect(resolved, intentCategories)) return 1;

  const partialHaystack = [
    intelligence.niche.value ?? "",
    ...intelligence.topics.value,
  ]
    .join(" ")
    .toLowerCase();
  const partial = intentCategories.some((category) =>
    partialHaystack.includes(category.trim().toLowerCase())
  );
  if (partial) return 0.6;

  return resolved.length === 0 ? 0.4 : 0.15;
}

function categoryMatchScore(
  creator: UnifiedCreatorResult,
  intent?: DiscoveryCoverageIntent
): number {
  const intentCategories = (intent?.categories ?? [])
    .map(normalizeToken)
    .filter(Boolean);

  if (intentCategories.length === 0) return 0.55;

  if (getCreatorIntelligenceMode() === "on") {
    return intelligenceCategoryScore(creator, intentCategories);
  }

  const creatorCategories = [
    ...creator.categories,
    ...(creator.browse_category_tags ?? []),
    creator.ai_category ?? "",
    creator.ai_niche ?? "",
  ]
    .map(normalizeToken)
    .filter(Boolean);

  if (creatorCategories.length === 0) return 0.25;

  const hits = intentCategories.filter((cat) =>
    creatorCategories.some((c) => c.includes(cat) || cat.includes(c))
  ).length;

  return Math.min(1, hits / intentCategories.length);
}

function availabilityScore(creator: UnifiedCreatorResult): number {
  switch (creator.enrichment_status) {
    case "enriched":
      return 1;
    case "partial":
      return 0.85;
    case "running":
    case "queued":
      return 0.7;
    case "failed":
      return 0.4;
    default:
      return creator.thinkway_score >= 50 ? 0.65 : 0.5;
  }
}

function qualityScore(creator: UnifiedCreatorResult): number {
  const confidence = Math.max(0, Math.min(1, creator.source_confidence));
  const dnaBoost = (creator.dna_completeness ?? 0) / 100;
  const completeness =
    creator.profile_image_url && creator.bio ? 1 : creator.profile_image_url || creator.bio ? 0.7 : 0.4;
  return confidence * 0.45 + completeness * 0.25 + dnaBoost * 0.3;
}

function historicalPerformanceScore(creator: UnifiedCreatorResult): number {
  return creator.historical_performance_score ?? 0.35;
}

function followerSupportScore(creator: UnifiedCreatorResult): number {
  const followers = creator.metrics.followers.value;
  if (followers == null || followers <= 0) return 0.4;
  return Math.min(1, Math.log10(followers + 1) / 7);
}

function discoveryRankScore(
  creator: UnifiedCreatorResult,
  intent?: DiscoveryCoverageIntent
): number {
  const brandFit =
    Math.max(0, Math.min(100, creator.brand_fit_score ?? creator.thinkway_score * 0.6)) / 100;
  const audience = audienceOverlapScore(creator, intent?.audience);
  const category = categoryMatchScore(creator, intent);
  const quality = qualityScore(creator);
  const availability = availabilityScore(creator);
  const historical = historicalPerformanceScore(creator);
  const thinkway = Math.max(0, Math.min(100, creator.thinkway_score)) / 100;
  const dnaCompleteness = Math.max(0, Math.min(100, creator.dna_completeness ?? 0)) / 100;
  const followerSupport = followerSupportScore(creator);

  return (
    brandFit * 0.22 +
    audience * 0.18 +
    category * 0.14 +
    quality * 0.12 +
    availability * 0.1 +
    historical * 0.08 +
    thinkway * 0.08 +
    dnaCompleteness * 0.06 +
    followerSupport * 0.02
  );
}

/** Rank unified browse rows — DNA-led signals; followers are supporting only. */
export function sortUnifiedCreatorsByDiscoveryRank(
  creators: UnifiedCreatorResult[],
  intent?: DiscoveryCoverageIntent
): UnifiedCreatorResult[] {
  return [...creators]
    .map((creator, index) => ({
      creator,
      index,
      rankScore: discoveryRankScore(creator, intent),
    }))
    .sort(
      (a, b) =>
        b.rankScore - a.rankScore ||
        (b.creator.search_rank ?? 0) - (a.creator.search_rank ?? 0) ||
        a.index - b.index
    )
    .map(({ creator }) => creator);
}

export { discoveryRankScore, categoryMatchScore, audienceOverlapScore };
