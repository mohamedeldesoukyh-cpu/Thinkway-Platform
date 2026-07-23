import { formatCreatorRecencyLabel } from "@/lib/creators/creator-hover-details";

import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { filterPlatformsForDisplay } from "@/lib/creators/creator-centric";
import {
  DISCOVERY_CREATOR_CATEGORY_CHIP_LIMIT,
  discoveryCreatorCategoriesLabel,
  resolveDiscoveryCreatorDisplayCategories,
} from "@/lib/creators/creator-display-categories";
import {
  resolveCreatorBrowsePlatformStats,
  type PlatformBrowseStatRow,
} from "@/lib/creators/resolve-browse-display-metrics";
import { creatorRecentPublicationDisplayUrl } from "@/lib/creators/recent-publication-thumb";
import type {
  CreatorRecentPublication,
  UnifiedCreatorPlatform,
  UnifiedCreatorResult,
} from "@/lib/creators/types";
import { resolvePrimaryProfileUrl } from "@/lib/discovery/profile-url";
import { resolveCreatorDiscoverySource } from "@/features/discovery/components/creator-search/creator-discovery-source";
import { audienceCountryLabel, brandSafetyMeta, formatEngagementRate, normalizeCountryCode } from "@/features/discovery/components/creator-search/creator-search-utils";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import {
  resolveCreatorEnrichmentStatus,
  type CreatorEnrichmentStatus,
} from "@/features/discovery/enrichment/status";
import type { DataSource } from "@/features/discovery/enrichment/components/data-source-badge";

export type DiscoveryCreatorViewModelOptions = {
  platformFilter?: string[];
  isApifyAcquired?: boolean;
  showCampaignRelevance?: boolean;
  bioMaxLength?: number;
};

export type DiscoveryCreatorBrandSafety = {
  label: string;
  className: string;
};

export type DiscoveryCreatorViewModel = {
  displayName: string;
  /** Primary platform @handle for exact-row name column. */
  handleLabel: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
  categories: string[];
  categoriesLabel: string;
  /** Exact-row meta line — categories label with handle fallback when empty. */
  metaLabel: string;
  bio: string | null;
  bioTruncated: string | null;
  countryLabel: string;
  countryCode: string | null;
  countryFlagCode: string | null;
  countryFlagCodes: string[];
  displayPlatforms: UnifiedCreatorPlatform[];
  primaryPlatform: UnifiedCreatorPlatform | null;
  platformStats: PlatformBrowseStatRow[];
  feedPublications: CreatorRecentPublication[];
  thinkwayStarLabel: string;
  thinkwayScore: number | null;
  brandSafety: DiscoveryCreatorBrandSafety;
  enrichmentStatus: CreatorEnrichmentStatus;
  discoverySource: Extract<DataSource, "apify" | "imported">;
  updatedLabel: string | null;
  engagementRateLabel: string;
  relevanceScore: number | null;
  /** Optional compact audience summary — only when DB has demographics/interests. */
  audienceSummaryLabel: string | null;
  /** Optional Creator DNA summary — only when ai_category/niche/completeness exist. */
  dnaSummaryLabel: string | null;
};

function truncateBio(bio: string | null | undefined, max: number): string | null {
  const trimmed = bio?.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function formatThinkwayStar(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return "—";
  return (Math.max(0, Math.min(100, score)) / 10).toFixed(1);
}

/** Star rating label (0–10) for profile summary and exact row. */
export function formatThinkwayStarLabel(score: number | null | undefined): string {
  return formatThinkwayStar(score);
}

function resolveCountryFlagCodes(
  creator: UnifiedCreatorResult,
  primaryPlatform: UnifiedCreatorPlatform | null
): string[] {
  return resolveCreatorCountryCodes({
    country_codes: creator.country_codes,
    country_code: creator.country_code,
    estimated_country: creator.estimated_country,
    platformAudienceCountries: [
      primaryPlatform?.audience_country,
      ...creator.platforms.map((platform) => platform.audience_country),
    ],
  });
}

/** @handle from primary platform — exact-row name column (no placeholder when missing). */
export function resolveDiscoveryCreatorHandleLabel(
  primaryPlatform: UnifiedCreatorPlatform | null
): string | null {
  const handle = primaryPlatform?.handle?.replace(/^@+/, "").trim();
  return handle ? `@${handle}` : null;
}

/** Meta line under creator name — shared by exact row and legacy grid row. */
export function resolveDiscoveryCreatorMetaLabel(
  creator: UnifiedCreatorResult,
  primaryPlatform: UnifiedCreatorPlatform | null
): string {
  const label = discoveryCreatorCategoriesLabel(creator);
  if (label !== "—") return label;
  return resolveDiscoveryCreatorHandleLabel(primaryPlatform) ?? "No categories";
}

function dominantAudienceAgeLabel(
  demographics: NonNullable<UnifiedCreatorResult["audience_demographics"]>
): string | null {
  const entries: Array<[string, number | null]> = [
    ["13–17", demographics.age["13_17"]],
    ["18–24", demographics.age["18_24"]],
    ["25–34", demographics.age["25_34"]],
    ["35–44", demographics.age["35_44"]],
    ["45–54", demographics.age["45_54"]],
    ["55+", demographics.age["55_plus"]],
  ];
  let best: string | null = null;
  let bestVal = -1;
  for (const [label, value] of entries) {
    if (value != null && value > bestVal) {
      best = label;
      bestVal = value;
    }
  }
  return best;
}

function resolveAudienceSummaryLabel(creator: UnifiedCreatorResult): string | null {
  const parts: string[] = [];
  const interests = (creator.audience_interests ?? []).filter(Boolean).slice(0, 2);
  if (interests.length > 0) parts.push(interests.join(", "));

  const demographics = creator.audience_demographics;
  if (demographics && demographics.source !== "unavailable") {
    const age = dominantAudienceAgeLabel(demographics);
    if (age) parts.push(`Age ${age}`);
    const male = demographics.gender.male;
    const female = demographics.gender.female;
    if (male != null || female != null) {
      const dominant =
        (male ?? 0) >= (female ?? 0)
          ? male != null
            ? `${Math.round(male)}% male`
            : null
          : female != null
            ? `${Math.round(female)}% female`
            : null;
      if (dominant) parts.push(dominant);
    }
    const topCountry = demographics.topCountries?.[0];
    if (topCountry?.name || topCountry?.code) {
      parts.push(topCountry.name ?? topCountry.code ?? "");
    }
  }

  return parts.length > 0 ? parts.filter(Boolean).join(" · ") : null;
}

function resolveDnaSummaryLabel(creator: UnifiedCreatorResult): string | null {
  const parts: string[] = [];
  if (creator.ai_category?.trim()) parts.push(creator.ai_category.trim());
  if (creator.ai_niche?.trim() && creator.ai_niche.trim() !== creator.ai_category?.trim()) {
    parts.push(creator.ai_niche.trim());
  }
  if (creator.role?.trim()) parts.push(creator.role.trim());
  if ((creator.dna_completeness ?? 0) > 0) {
    parts.push(`DNA ${Math.round(creator.dna_completeness ?? 0)}%`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function resolveDisplayEngagementRate(
  creator: UnifiedCreatorResult,
  displayPlatforms: UnifiedCreatorPlatform[]
): string {
  if (displayPlatforms.length === 1) {
    return formatEngagementRate(displayPlatforms[0]?.engagement_rate ?? null);
  }
  return formatEngagementRate(creator.metrics.engagement_rate.value);
}

function resolveFeedPublications(
  creator: UnifiedCreatorResult
): CreatorRecentPublication[] {
  const fromCreator = creator.recent_publications ?? [];
  const merged =
    fromCreator.length > 0
      ? fromCreator
      : creator.platforms.flatMap((platform) => platform.recent_publications ?? []);
  return merged
    .filter((pub) => Boolean(creatorRecentPublicationDisplayUrl(pub)))
    .slice(0, 3);
}

/**
 * Single mapping layer for Discovery creator row display fields.
 * Used by DiscoveryCreatorExactRow to prevent data-contract drift.
 */
export function buildDiscoveryCreatorViewModel(
  creator: UnifiedCreatorResult,
  options: DiscoveryCreatorViewModelOptions = {}
): DiscoveryCreatorViewModel {
  const {
    platformFilter,
    isApifyAcquired,
    showCampaignRelevance = false,
    bioMaxLength = 72,
  } = options;

  const profileSource = creatorProfileSourceFromUnified(creator);
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms, platformFilter);
  const primaryPlatform = displayPlatforms[0] ?? creator.platforms[0] ?? null;
  const profileUrl = resolvePrimaryProfileUrl(creator.platforms);
  const categories = resolveDiscoveryCreatorDisplayCategories(creator);
  const categoriesLabel = discoveryCreatorCategoriesLabel(creator);
  const countryFlagCodes = resolveCountryFlagCodes(creator, primaryPlatform);
  const countryLabel = formatCreatorCountryLabels(creator, countryFlagCodes);
  const countryFlagCode = countryFlagCodes[0] ?? null;

  return {
    displayName: creator.display_name,
    handleLabel: resolveDiscoveryCreatorHandleLabel(primaryPlatform),
    avatarUrl: profileSource.avatarUrl ?? null,
    profileUrl: profileUrl ?? profileSource.profile_url ?? null,
    categories: categories.slice(0, DISCOVERY_CREATOR_CATEGORY_CHIP_LIMIT),
    categoriesLabel,
    metaLabel: resolveDiscoveryCreatorMetaLabel(creator, primaryPlatform),
    bio: creator.bio?.trim() || null,
    bioTruncated: truncateBio(creator.bio, bioMaxLength),
    countryLabel,
    countryCode: normalizeCountryCode(countryLabel),
    countryFlagCode,
    countryFlagCodes,
    displayPlatforms,
    primaryPlatform,
    platformStats: resolveCreatorBrowsePlatformStats({
      ...creator,
      platforms: displayPlatforms,
    }),
    feedPublications: resolveFeedPublications(creator),
    thinkwayStarLabel: formatThinkwayStar(creator.thinkway_score),
    thinkwayScore: creator.thinkway_score ?? null,
    brandSafety: brandSafetyMeta(creator.authenticity_score),
    enrichmentStatus: resolveCreatorEnrichmentStatus(creator.enrichment_status),
    discoverySource: resolveCreatorDiscoverySource(creator, {
      sessionApify: isApifyAcquired,
    }),
    updatedLabel: formatCreatorRecencyLabel(creator.last_enriched_at, creator.updated_at),
    engagementRateLabel: resolveDisplayEngagementRate(creator, displayPlatforms),
    relevanceScore: showCampaignRelevance ? (creator.campaign_relevance_score ?? null) : null,
    audienceSummaryLabel: resolveAudienceSummaryLabel(creator),
    dnaSummaryLabel: resolveDnaSummaryLabel(creator),
  };
}
