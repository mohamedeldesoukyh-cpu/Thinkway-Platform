import { resolveCreatorTierLabel, type CreatorTierLabel } from "@/lib/creators/creator-tier";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
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
  language?: string;
  audienceSummary?: string;
  priceEstimate?: string;
  thinkwayScore?: number;
  brandFit?: number;
  reason?: string;
  matchPercent?: number;
  tier?: CreatorTierLabel;
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
  if (account?.follower_count) return account.follower_count;
  if (metrics?.followers?.value) return metrics.followers.value;
  return undefined;
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
  quotationPriceByInfluencerId?: Map<string, CreatorQuotationPriceReference>;
  /** Workflow-persisted CIP fit scores (keyed by inf:/dis: or bare uuid). */
  campaignFitScoresByCreatorId?: Record<string, number>;
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
  const fitScore =
    persistedCampaignFitScore(creator.unified_id, options?.campaignFitScoresByCreatorId) ??
    creator.campaign_relevance_score ??
    creator.brand_fit_score ??
    creator.thinkway_score ??
    70 + index * 3;

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
      campaignRelevanceScore:
        persistedCampaignFitScore(creator.unified_id, options?.campaignFitScoresByCreatorId) ??
        creator.campaign_relevance_score ??
        undefined,
    },
    industry,
    index
  );

  return whySelected;
}

function resolveHydratedVendorCountry(creator: UnifiedCreatorResult): string | undefined {
  const label = formatCreatorCountryLabels(creator);
  return label !== "—" ? label : undefined;
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
  const persistedFit = persistedCampaignFitScore(
    creator.unified_id,
    options?.campaignFitScoresByCreatorId
  );
  const fitScore =
    persistedFit ??
    creator.campaign_relevance_score ??
    creator.brand_fit_score ??
    creator.thinkway_score ??
    avgFit ??
    70 + index * 3;
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
    language: creator.language_codes?.slice(0, 2).join(" / ") || "Arabic / English",
    audienceSummary:
      creator.audience_interests?.slice(0, 2).join(", ") ??
      creator.categories?.slice(0, 2).join(", ") ??
      "Category audience",
    thinkwayScore: creator.thinkway_score,
    brandFit: fitScore,
    reason: buildPerCreatorReason(creator, index, rationale, preferredPlatforms, options),
    matchPercent: Math.min(98, fitScore + 5),
    priceEstimate,
    tier: resolveCreatorTierLabel({
      followers,
      role: creator.role,
    }),
  };
}
