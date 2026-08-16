import { resolveCreatorTierLabel, type CreatorTierLabel } from "@/lib/creators/creator-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { studioCreatorHomeCountryLabel } from "./studio-market-creators";
import { resolveStudioCreatorCategories } from "./studio-creator-category-fit";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";

import { estimateCreatorPostFee } from "./creator-fee-estimator";
import {
  buildSocialProfileUrl,
  resolvePrimaryPlatformAccount,
  resolvePrimaryPlatformLabel,
} from "./creator-platform-utils";
import {
  deriveVendorRankingFactors,
} from "./presentation-intelligence";
import { detectIndustryFromBrief } from "./industry-intelligence";
import type { CreatorQuotationPriceReference } from "@/lib/creators/quotation-price-reference";
import {
  formatStudioEciReason,
  lookupStudioEciSignal,
  type StudioEciPlanningSignal,
} from "./eci/project-studio-eci-signal";

export type HydratedVendor = {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl?: string;
  profileUrl?: string;
  followers?: number;
  engagementRate?: number;
  country?: string;
  /** ISO-2 home country — not audience. */
  countryCode?: string | null;
  language?: string;
  audienceSummary?: string;
  /** Canonical Discovery categories used for brief-fit ranking. */
  categories?: string[];
  priceEstimate?: string;
  /** @deprecated Discovery Thinkway Score — not Studio planning SSOT. Prefer brandFit from ECI. */
  thinkwayScore?: number;
  /** Planning fit — Enterprise Creator Intelligence investment score when available. */
  brandFit?: number;
  reason?: string;
  matchPercent?: number;
  tier?: CreatorTierLabel;
  /** ECI investment recommendation label when loaded. */
  eciRecommendation?: string;
  eciConfidencePercent?: number | null;
  /** Full planning signal for cards / detail / proposal (consume-only). */
  planningSignal?: StudioEciPlanningSignal;
};

function extractHandleFromAccount(
  account: UnifiedCreatorResult["platforms"][number] | undefined,
  creator: UnifiedCreatorResult
): string {
  if (account?.handle) return `@${account.handle.replace(/^@/, "")}`;
  const fallback = creator.platforms?.[0];
  if (fallback?.handle) return `@${fallback.handle.replace(/^@/, "")}`;
  return `@${creator.display_name?.replace(/\s+/g, "").toLowerCase() ?? "creator"}`;
}

function extractPlatform(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): string {
  return resolvePrimaryPlatformLabel(creator, preferredPlatforms);
}

function extractPrimaryAccount(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
) {
  return resolvePrimaryPlatformAccount(creator, preferredPlatforms) ?? creator.platforms?.[0];
}

function extractFollowers(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): number | undefined {
  const account = extractPrimaryAccount(creator, preferredPlatforms);
  const metrics = creator.metrics;
  const candidates = [
    account?.follower_count,
    metrics?.followers?.value,
    ...(creator.platforms ?? []).map((platform) => platform.follower_count),
  ].filter((value): value is number => typeof value === "number" && value > 0);
  if (candidates.length === 0) return undefined;
  return Math.max(...candidates);
}

function extractAvatarUrl(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): string | undefined {
  const account = extractPrimaryAccount(creator, preferredPlatforms);
  const primary = creator.primaryAvatarUrl ?? creator.profile_image_url;
  if (primary?.trim()) return primary.trim();

  const resolved = resolveBrowseCreatorProfileImageUrl({
    platform: account?.platform,
    platformPictureUrl: account?.profile_picture_url,
    influencerAvatarUrl: creator.profile_image_url,
    discoveryProfileImageUrl: null,
  });
  return resolved ?? undefined;
}

function extractProfileUrl(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): string | undefined {
  const account = extractPrimaryAccount(creator, preferredPlatforms);
  const fromDb = account?.profile_url?.trim();
  if (fromDb) return fromDb;
  if (account) {
    return buildSocialProfileUrl(account.platform, extractHandleFromAccount(account, creator));
  }
  return undefined;
}

function extractEngagement(
  creator: UnifiedCreatorResult,
  preferredPlatforms?: string[]
): number | undefined {
  const account = extractPrimaryAccount(creator, preferredPlatforms);
  if (account?.engagement_rate) return account.engagement_rate;
  if (creator.metrics?.engagement_rate?.value) return creator.metrics.engagement_rate.value;
  return undefined;
}

export type HydrationMapperOptions = {
  preferredPlatforms?: string[];
  currency?: string;
  campaignMarkets?: string[];
  campaignIndustry?: string;
  campaignType?: string;
  briefText?: string;
  objective?: string;
  audience?: string;
  quotationPriceByInfluencerId?: Map<string, CreatorQuotationPriceReference>;
  /**
   * Legacy persisted scores — used only when ECI signal is unavailable.
   * Sprint 2 planning SSOT is Enterprise Creator Intelligence.
   */
  campaignFitScoresByCreatorId?: Record<string, number>;
  /** ECI planning signals (consume-only). */
  eciSignalsByInfluencerId?: Map<string, StudioEciPlanningSignal>;
};

function persistedCampaignFitScore(
  creatorId: string,
  scores?: Record<string, number>
): number | undefined {
  if (!scores) return undefined;
  const raw = creatorId.trim();
  const bare = raw.replace(/^inf:/, "").replace(/^dis:/, "");
  return (
    scores[raw] ??
    scores[`inf:${bare}`] ??
    scores[`dis:${bare}`] ??
    scores[bare]
  );
}

function buildPerCreatorReason(
  creator: UnifiedCreatorResult,
  index: number,
  rationale?: string,
  preferredPlatforms?: string[],
  options?: HydrationMapperOptions
): string | undefined {
  if (rationale && !/no creators available/i.test(rationale)) return rationale;

  const industry = detectIndustryFromBrief(
    [
      creator.categories?.join(" "),
      creator.audience_interests?.join(" "),
      creator.bio,
    ]
      .filter(Boolean)
      .join(" ")
  );

  const platform = extractPlatform(creator, preferredPlatforms);
  const followers = extractFollowers(creator, preferredPlatforms);
  const engagementRate = extractEngagement(creator, preferredPlatforms);
  const account = extractPrimaryAccount(creator, preferredPlatforms);
  const eci = lookupStudioEciSignal(
    options?.eciSignalsByInfluencerId,
    creator.influencer_id ?? creator.unified_id
  );
  if (eci) return formatStudioEciReason(eci);

  const fitScore =
    persistedCampaignFitScore(creator.unified_id, options?.campaignFitScoresByCreatorId) ??
    60 + index;

  const { whySelected } = deriveVendorRankingFactors(
    {
      displayName: creator.display_name ?? `Creator ${index + 1}`,
      handle: extractHandleFromAccount(account, creator),
      platform,
      followers,
      engagementRate,
      country: resolveHydratedVendorCountry(creator),
      audienceSummary:
        creator.audience_interests?.slice(0, 2).join(", ") ??
        creator.categories?.slice(0, 2).join(", ") ??
        undefined,
      brandFit: fitScore,
    },
    industry,
    index
  );

  return whySelected;
}

function resolveHydratedVendorCountry(creator: UnifiedCreatorResult): string | undefined {
  return studioCreatorHomeCountryLabel({
    countryCode: creator.country_code,
    countryCodes: creator.country_codes,
    estimatedCountry: creator.estimated_country,
    audienceCountries: creator.platforms.map((platform) => platform.audience_country),
  });
}

export function mapCreatorToHydratedVendor(
  creator: UnifiedCreatorResult,
  index: number,
  rationale?: string,
  avgFit?: number,
  options?: HydrationMapperOptions
): HydratedVendor {
  const preferredPlatforms = options?.preferredPlatforms;
  const account = extractPrimaryAccount(creator, preferredPlatforms);
  const platform = extractPlatform(creator, preferredPlatforms);
  const followers = extractFollowers(creator, preferredPlatforms);
  const eci = lookupStudioEciSignal(
    options?.eciSignalsByInfluencerId,
    creator.influencer_id ?? creator.unified_id
  );
  const persistedFit = persistedCampaignFitScore(
    creator.unified_id,
    options?.campaignFitScoresByCreatorId
  );
  // Planning SSOT: ECI investment → persisted ECI-backed scores → neutral (never Thinkway/CIP).
  const fitScore =
    eci?.investmentScore ??
    persistedFit ??
    avgFit ??
    60;
  const influencerId = creator.influencer_id ?? null;
  const quotationRef =
    influencerId != null
      ? options?.quotationPriceByInfluencerId?.get(influencerId)
      : undefined;
  const displayCurrency = options?.currency ?? creator.suggested_currency ?? "EGP";
  const priceEstimate = estimateCreatorPostFee({
    followers,
    platform,
    currency: displayCurrency,
    quotationAvgCost:
      quotationRef != null &&
      (quotationRef.avg_cost_currency === displayCurrency || displayCurrency === "EGP")
        ? quotationRef.avg_cost_currency === displayCurrency
          ? quotationRef.avg_cost
          : quotationRef.avg_cost_egp
        : quotationRef?.avg_cost ?? null,
    quotationQuoteCount: quotationRef?.quote_count,
    quotationCurrency: quotationRef?.avg_cost_currency ?? displayCurrency,
  });

  return {
    id: creator.unified_id,
    displayName: creator.display_name ?? `Creator ${index + 1}`,
    handle: extractHandleFromAccount(account, creator),
    platform,
    avatarUrl: extractAvatarUrl(creator, preferredPlatforms),
    profileUrl: extractProfileUrl(creator, preferredPlatforms),
    followers,
    engagementRate: extractEngagement(creator, preferredPlatforms),
    country: resolveHydratedVendorCountry(creator),
    countryCode: creator.country_code,
    language: creator.language_codes?.slice(0, 2).join(" / ") || "Arabic / English",
    audienceSummary:
      creator.audience_interests?.slice(0, 2).join(", ") ??
      creator.categories?.slice(0, 2).join(", ") ??
      "Category audience",
    categories: resolveStudioCreatorCategories({
      categories: [
        ...(creator.browse_category_tags ?? []),
        ...(creator.categories ?? []),
        creator.ai_category,
        creator.ai_niche,
      ],
      audienceSummary: creator.audience_interests?.slice(0, 3).join(", "),
      handle: extractHandleFromAccount(account, creator),
      displayName: creator.display_name,
    }),
    thinkwayScore: eci?.investmentScore ?? undefined,
    brandFit: fitScore,
    reason: buildPerCreatorReason(creator, index, rationale, preferredPlatforms, options),
    matchPercent: Math.min(98, fitScore + 5),
    priceEstimate,
    tier: resolveCreatorTierLabel({
      followers,
      role: creator.role,
    }),
    eciRecommendation: eci?.recommendation,
    eciConfidencePercent: eci?.confidencePercent ?? null,
    planningSignal: eci,
  };
}
