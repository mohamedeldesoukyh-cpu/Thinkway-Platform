/**
 * DNA-first hydration for unified browse — joins creator_dna / staging into browse rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  calculateDnaCompleteness,
  historicalPerformanceRankScore,
} from "@/features/creator-dna/services/dna-completeness-engine";
import { parseCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { envelopeHasValue } from "@/features/creator-dna/services/field-envelope";
import {
  extractDnaAvatarUrl,
  resolveCreatorAvatarWithDnaFallback,
} from "@/lib/creators/dna-avatar";
import { normalizeCreatorRecentPublications } from "@/lib/creators/recent-publication-thumb";
import type { CreatorDNADocument } from "@/features/creator-dna/types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { metricWithConfidence } from "@/lib/creators/confidence";
import type {
  UnifiedCreatorMetrics,
  UnifiedCreatorPlatform,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { isPositiveNumericMetric } from "@/lib/creators/creator-display-utils";
import { formatCreatorBio, formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { isDnaCompletenessCalculationEnabled } from "@/lib/discovery/control-center/discovery-control-policy";
import { getCachedDiscoveryControlSettings } from "@/lib/discovery/control-center/discovery-control-service";

type DnaRow = {
  influencer_id: string;
  document: unknown;
};

type StagingRow = {
  discovered_profile_id: string;
  document: unknown;
};

/** Completeness is always derived from document JSON — never required from DB column. */
function completenessFromDocument(document: CreatorDNADocument): number {
  if (!isDnaCompletenessCalculationEnabled(getCachedDiscoveryControlSettings())) {
    return 0;
  }
  return calculateDnaCompleteness(document).dnaCompleteness;
}

function envelopeValue<T>(envelope: { value: T } | undefined): T | null {
  if (!envelope) return null;
  return envelope.value ?? null;
}

function mergeStringArray(primary: string[] | undefined, dna: string[] | null | undefined): string[] {
  const base = primary ?? [];
  const fromDna = dna ?? [];
  if (fromDna.length === 0) return base;
  return [...new Set([...fromDna, ...base])];
}

function shouldOverlayNumericMetric(
  existing: number | null | undefined,
  dnaValue: number | null | undefined
): boolean {
  if (dnaValue == null || dnaValue <= 0) return false;
  return existing == null || existing <= 0;
}

/**
 * Discovery per-platform columns read platform account rows. After Refresh Metrics,
 * IPL → Creator DNA is updated first; fill missing platform-account metrics from DNA
 * for the platform that was last enriched (identity.platform).
 */
export function overlayPlatformMetricsFromDna(
  platforms: UnifiedCreatorPlatform[],
  document: CreatorDNADocument
): UnifiedCreatorPlatform[] {
  const dnaPlatform = envelopeValue(document.identity.platform);
  if (!dnaPlatform) return platforms;

  const platformKey = canonicalPlatformKey(dnaPlatform);
  const dnaFollowers = envelopeValue(document.metrics.followers);
  const dnaAvgViews = envelopeValue(document.metrics.avgViews);
  const dnaEngagementRate = envelopeValue(document.metrics.engagementRate);

  let matched = false;
  const updated = platforms.map((platform) => {
    if (canonicalPlatformKey(platform.platform) !== platformKey) return platform;
    matched = true;
    return {
      ...platform,
      follower_count: shouldOverlayNumericMetric(platform.follower_count, dnaFollowers)
        ? dnaFollowers
        : platform.follower_count,
      avg_views: shouldOverlayNumericMetric(platform.avg_views, dnaAvgViews)
        ? dnaAvgViews
        : platform.avg_views,
      engagement_rate: shouldOverlayNumericMetric(
        platform.engagement_rate,
        dnaEngagementRate
      )
        ? dnaEngagementRate
        : platform.engagement_rate,
    };
  });

  return matched ? updated : platforms;
}

function metricFromDnaOrFallback(
  dnaValue: number | null | undefined,
  dnaConfidence: number,
  fallback: UnifiedCreatorMetrics[keyof UnifiedCreatorMetrics],
  confLevel: (conf: number) => "verified" | "estimated" | "inferred"
) {
  if (isPositiveNumericMetric(dnaValue)) {
    return metricWithConfidence(dnaValue, confLevel(dnaConfidence));
  }
  return fallback;
}

function metricsFromDna(document: CreatorDNADocument, fallback: UnifiedCreatorMetrics): UnifiedCreatorMetrics {
  const m = document.metrics;
  const confLevel = (conf: number) =>
    conf >= 0.85 ? ("verified" as const) : conf >= 0.6 ? ("estimated" as const) : ("inferred" as const);

  return {
    followers: metricFromDnaOrFallback(
      m.followers.value,
      m.followers.confidence,
      fallback.followers,
      confLevel
    ),
    engagement_rate: metricFromDnaOrFallback(
      m.engagementRate.value,
      m.engagementRate.confidence,
      fallback.engagement_rate,
      confLevel
    ),
    avg_likes: metricFromDnaOrFallback(
      m.avgLikes.value,
      m.avgLikes.confidence,
      fallback.avg_likes,
      confLevel
    ),
    avg_comments: metricFromDnaOrFallback(
      m.avgComments.value,
      m.avgComments.confidence,
      fallback.avg_comments,
      confLevel
    ),
    avg_views: metricFromDnaOrFallback(
      m.avgViews.value,
      m.avgViews.confidence,
      fallback.avg_views,
      confLevel
    ),
    posting_frequency_per_week: fallback.posting_frequency_per_week,
  };
}

function applyDnaDocumentToCreator(
  creator: UnifiedCreatorResult,
  document: CreatorDNADocument
): UnifiedCreatorResult {
  const completeness = completenessFromDocument(document);
  const displayName = envelopeValue(document.identity.displayName);
  const bio = envelopeValue(document.identity.bio);
  const dnaAvatar = extractDnaAvatarUrl(document);
  const enriched =
    creator.enrichment_status === "enriched" || creator.enrichment_status === "partial";
  const mergedAvatar = resolveCreatorAvatarWithDnaFallback({
    profileImageUrl: creator.profile_image_url,
    primaryAvatarUrl: creator.primaryAvatarUrl,
    dnaAvatarUrl: dnaAvatar,
    preferEnrichedDna: enriched && Boolean(dnaAvatar),
  });
  const country = envelopeValue(document.audience.country) ?? creator.country_code;
  const categories = mergeStringArray(creator.categories, envelopeValue(document.audience.categories));
  const interests = mergeStringArray(
    creator.audience_interests,
    envelopeValue(document.audience.interests)
  );
  const hashtags = mergeStringArray(creator.hashtags, envelopeValue(document.audience.hashtags));
  const mentions = mergeStringArray(creator.mentions, envelopeValue(document.audience.mentions));
  const languages = envelopeValue(document.audience.languages) ?? creator.language_codes;

  const thinkwayFromDna = envelopeValue(document.scores.thinkwayScore);
  const brandFitFromDna = envelopeValue(document.scores.brandFit);
  const authenticityFromDna = envelopeValue(document.scores.authenticityScore);
  const aiCategory = envelopeValue(document.scores.aiCategory) ?? creator.ai_category;
  const aiNiche = envelopeValue(document.scores.aiNiche) ?? creator.ai_niche;

  const metrics = metricsFromDna(document, creator.metrics);
  const isVerified =
    envelopeValue(document.identity.isVerified) === true || creator.is_platform_verified;

  const dnaRecentPublications = envelopeValue(document.content.recentPublications);
  const recentPublications =
    dnaRecentPublications && dnaRecentPublications.length > 0
      ? normalizeCreatorRecentPublications(dnaRecentPublications)
      : creator.recent_publications;

  const contactEmail = envelopeValue(document.contact.email) ?? creator.contact_email;
  const contactPhone = envelopeValue(document.contact.phone) ?? creator.contact_phone;
  const contactLinks =
    envelopeValue(document.contact.links)?.length
      ? envelopeValue(document.contact.links)
      : creator.contact_links;

  return {
    ...creator,
    display_name: displayName ? formatCreatorDisplayName(displayName) : creator.display_name,
    bio: bio ? formatCreatorBio(bio) : creator.bio,
    profile_image_url: mergedAvatar,
    primaryAvatarUrl: mergedAvatar,
    platforms: overlayPlatformMetricsFromDna(creator.platforms, document),
    country_code: country ?? creator.country_code,
    estimated_country: country ?? creator.estimated_country,
    categories,
    browse_category_tags: categories.length > 0 ? categories : creator.browse_category_tags,
    audience_interests: interests,
    language_codes: languages,
    hashtags,
    mentions,
    metrics,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    contact_links: contactLinks ?? creator.contact_links,
    recent_publications: recentPublications,
    ai_category: aiCategory,
    ai_niche: aiNiche,
    authenticity_score: authenticityFromDna ?? creator.authenticity_score,
    thinkway_score: thinkwayFromDna ?? creator.thinkway_score,
    brand_fit_score: brandFitFromDna ?? creator.brand_fit_score,
    is_platform_verified: isVerified,
    source_confidence: Math.max(
      creator.source_confidence,
      document.identity.displayName.confidence,
      document.metrics.followers.confidence
    ),
    dna_completeness: completeness,
    historical_performance_score: historicalPerformanceRankScore(document),
    dna_verification_required: calculateDnaCompleteness(document).verificationRequired,
  };
}

export async function loadCanonicalDnaByInfluencerIds(
  supabase: SupabaseClient,
  influencerIds: string[]
): Promise<Map<string, CreatorDNADocument>> {
  const map = new Map<string, CreatorDNADocument>();
  if (influencerIds.length === 0) return map;

  const { data, error } = await supabase
    .from("creator_dna")
    .select("influencer_id, document")
    .in("influencer_id", influencerIds);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as DnaRow[]) {
    const document = parseCreatorDNADocument(row.document);
    if (
      !envelopeHasValue(document.identity.displayName) &&
      !envelopeHasValue(document.metrics.followers) &&
      !envelopeHasValue(document.identity.avatarUrl)
    ) {
      continue;
    }
    map.set(row.influencer_id, document);
  }

  return map;
}

export async function loadStagingDnaByProfileIds(
  supabase: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, CreatorDNADocument>> {
  const map = new Map<string, CreatorDNADocument>();
  if (profileIds.length === 0) return map;

  const { data, error } = await supabase
    .from("creator_dna_staging")
    .select("discovered_profile_id, document")
    .in("discovered_profile_id", profileIds);

  if (error) throw new Error(error.message);

  for (const row of (data ?? []) as StagingRow[]) {
    const document = parseCreatorDNADocument(row.document);
    map.set(row.discovered_profile_id, document);
  }

  return map;
}

export async function hydrateCreatorsWithDna(
  supabase: SupabaseClient,
  creators: UnifiedCreatorResult[]
): Promise<UnifiedCreatorResult[]> {
  if (creators.length === 0) return creators;

  const influencerIds = creators
    .map((c) => c.influencer_id)
    .filter((id): id is string => Boolean(id));
  const profileIds = creators
    .map((c) => c.discovered_profile_id)
    .filter((id): id is string => Boolean(id));

  const [canonical, staging] = await Promise.all([
    loadCanonicalDnaByInfluencerIds(supabase, influencerIds),
    loadStagingDnaByProfileIds(supabase, profileIds),
  ]);

  return creators.map((creator) => {
    if (creator.influencer_id) {
      const document = canonical.get(creator.influencer_id);
      if (document) {
        return applyDnaDocumentToCreator(creator, document);
      }
    }
    if (creator.discovered_profile_id) {
      const document = staging.get(creator.discovered_profile_id);
      if (document) {
        return applyDnaDocumentToCreator(creator, document);
      }
    }
    return {
      ...creator,
      dna_completeness: creator.dna_completeness ?? 0,
      historical_performance_score: creator.historical_performance_score ?? 0.35,
    };
  });
}
