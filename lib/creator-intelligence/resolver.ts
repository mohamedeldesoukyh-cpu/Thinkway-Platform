/**
 * Creator Intelligence Resolver — the ONE place creator semantics are resolved.
 *
 * Input: a UnifiedCreatorResult (already the merge point of influencers,
 * discovered_profiles, Creator DNA hydration, and profile_ai_scores).
 * Output: a CreatorIntelligence profile with per-attribute source+confidence.
 *
 * Precedence per attribute (best first):
 *   Creator DNA → AI enrichment → bio inference → declared/platform data.
 *
 * HARD RULE — provenance is never intelligence: for public-discovery creators,
 * `categories`/`browse_category_tags` mirror discovered_profiles.category_tags,
 * which is written from the DISCOVERING CAMPAIGN's search intent (and wiped on
 * re-crawl). The resolver never reads it for classification. Internal
 * influencers' `categories` come from bio inference at enrichment time and ARE
 * intelligence.
 */
import { inferCategoriesFromProfileSignals } from "@/lib/creator-enrichment/category-inference";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  resolveCanonicalCategories,
  resolveCountryCode,
  resolveDiscoveryPlatform,
  resolveLanguageCodes,
  resolveTopics,
  type BrandSafetyLevel,
} from "./taxonomy";
import type {
  CreatorIntelligence,
  IntelligenceAttribute,
  IntelligenceSource,
} from "./types";

/** Default confidence per resolution source (tunable, single definition). */
const SOURCE_CONFIDENCE: Readonly<Record<IntelligenceSource, number>> = {
  creator_dna: 0.9,
  ai_enrichment: 0.75,
  bio_inference: 0.5,
  platform_metrics: 0.7,
  declared: 0.6,
  unresolved: 0,
};

function attribute<T>(value: T, source: IntelligenceSource): IntelligenceAttribute<T> {
  return { value, source, confidence: SOURCE_CONFIDENCE[source] };
}

/** DNA hydration marks hydrated rows with dna_completeness > 0. */
function hasDnaSignal(creator: UnifiedCreatorResult): boolean {
  return (creator.dna_completeness ?? 0) > 0;
}

function isPublicDiscovery(creator: UnifiedCreatorResult): boolean {
  return creator.source_type === "public_discovery";
}

/**
 * Stored categories are intelligence ONLY for non-discovery creators (bio
 * inference / DNA overlay). For public_discovery rows they are crawl
 * provenance and are excluded here by design.
 */
function storedIntelligenceCategories(creator: UnifiedCreatorResult): string[] {
  if (isPublicDiscovery(creator)) return [];
  return resolveCanonicalCategories([
    ...(creator.browse_category_tags ?? []),
    ...(creator.categories ?? []),
  ]);
}

function resolveCategories(
  creator: UnifiedCreatorResult
): IntelligenceAttribute<string[]> {
  const stored = storedIntelligenceCategories(creator);
  if (stored.length > 0) {
    return attribute(stored, hasDnaSignal(creator) ? "creator_dna" : "bio_inference");
  }

  const fromAi = resolveCanonicalCategories([creator.ai_category]);
  if (fromAi.length > 0) return attribute(fromAi, "ai_enrichment");

  const inferred = resolveCanonicalCategories(
    inferCategoriesFromProfileSignals({
      bio: creator.bio,
      hashtags: creator.hashtags,
      mentions: creator.mentions,
      displayName: creator.display_name,
    })
  );
  if (inferred.length > 0) return attribute(inferred, "bio_inference");

  return attribute<string[]>([], "unresolved");
}

function resolveNiche(creator: UnifiedCreatorResult): IntelligenceAttribute<string | null> {
  if (creator.ai_niche?.trim()) return attribute(creator.ai_niche.trim(), "ai_enrichment");
  return attribute<string | null>(null, "unresolved");
}

function resolveCreatorTopics(creator: UnifiedCreatorResult): IntelligenceAttribute<string[]> {
  const topics = resolveTopics([
    ...(creator.hashtags ?? []),
    ...(creator.audience_interests ?? []),
  ]);
  if (topics.length === 0) return attribute<string[]>([], "unresolved");
  return attribute(topics, (creator.hashtags?.length ?? 0) > 0 ? "ai_enrichment" : "declared");
}

function resolveLanguages(creator: UnifiedCreatorResult): IntelligenceAttribute<string[]> {
  const codes = resolveLanguageCodes(creator.language_codes);
  if (codes.length === 0) return attribute<string[]>([], "unresolved");
  return attribute(codes, "declared");
}

function resolveAudience(creator: UnifiedCreatorResult): CreatorIntelligence["audience"] {
  const hasDemographics = Boolean(creator.audience_demographics);
  const audienceCountry = resolveCountryCode(creator.estimated_country) || null;
  const creatorCountry = resolveCountryCode(creator.country_code) || null;

  return {
    primaryCountry:
      audienceCountry && hasDemographics
        ? attribute<string | null>(audienceCountry, "platform_metrics")
        : creatorCountry || audienceCountry
          ? attribute<string | null>(creatorCountry ?? audienceCountry, "declared")
          : attribute<string | null>(null, "unresolved"),
    interests: (() => {
      const interests = resolveTopics(creator.audience_interests);
      return interests.length > 0
        ? attribute(interests, "platform_metrics")
        : attribute<string[]>([], "unresolved");
    })(),
    hasDemographics,
  };
}

/**
 * Brand safety — conservative until dedicated toxicity/content-risk enrichment
 * lands: platform-verified + strong authenticity resolves low_risk; otherwise
 * unknown. NEVER defaults to safe.
 */
function resolveBrandSafety(creator: UnifiedCreatorResult): CreatorIntelligence["brandSafety"] {
  const signals: string[] = [];
  if (creator.is_platform_verified) signals.push("platform_verified");
  if (creator.authenticity_score != null) {
    signals.push(`authenticity_score=${creator.authenticity_score}`);
  }

  let level: BrandSafetyLevel = "unknown";
  let source: IntelligenceSource = "unresolved";
  if (creator.is_platform_verified && (creator.authenticity_score ?? 0) >= 70) {
    level = "low_risk";
    source = "platform_metrics";
  }

  return { level: attribute(level, source), signals };
}

function resolvePlatforms(creator: UnifiedCreatorResult): string[] {
  const seen = new Set<string>();
  for (const account of creator.platforms ?? []) {
    const canonical = resolveDiscoveryPlatform(account.platform);
    if (canonical) seen.add(canonical);
  }
  return [...seen];
}

function resolveMetricsSummary(creator: UnifiedCreatorResult): CreatorIntelligence["metrics"] {
  let maxFollowers: number | null = null;
  let maxEngagementRate: number | null = null;
  for (const account of creator.platforms ?? []) {
    if (account.follower_count != null) {
      maxFollowers = Math.max(maxFollowers ?? 0, account.follower_count);
    }
    if (account.engagement_rate != null) {
      maxEngagementRate = Math.max(maxEngagementRate ?? 0, account.engagement_rate);
    }
  }
  return { maxFollowers, maxEngagementRate };
}

/**
 * Resolve the canonical Creator Intelligence profile for a creator.
 * Pure and deterministic apart from the resolvedAt timestamp.
 */
export function resolveCreatorIntelligence(creator: UnifiedCreatorResult): CreatorIntelligence {
  return {
    unifiedId: creator.unified_id,
    sourceType: creator.source_type,
    displayName: creator.display_name,
    platforms: resolvePlatforms(creator),
    categories: resolveCategories(creator),
    niche: resolveNiche(creator),
    topics: resolveCreatorTopics(creator),
    languages: resolveLanguages(creator),
    audience: resolveAudience(creator),
    brandSafety: resolveBrandSafety(creator),
    metrics: resolveMetricsSummary(creator),
    scores: {
      thinkway: creator.thinkway_score ?? null,
      brandFit: creator.brand_fit_score ?? null,
      authenticity: creator.authenticity_score ?? null,
    },
    resolvedAt: new Date().toISOString(),
  };
}

/** Resolve a batch (browse pages, slate pools). */
export function resolveCreatorIntelligenceBatch(
  creators: ReadonlyArray<UnifiedCreatorResult>
): CreatorIntelligence[] {
  return creators.map(resolveCreatorIntelligence);
}
