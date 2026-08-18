import { loadCreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence";
import type { CreatorIntelligenceBundle } from "@/lib/enterprise-creator-intelligence";
import { resolveUnifiedCreatorsByRefs, resolveCreatorFromRefLookup } from "@/lib/creators/unified-browse";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import { clientSafeFitCopy, formatLocation } from "./format";
import { parseDeliverableItems, summarizeCreatorDeliverables } from "./deliverables";
import {
  enrichSnapshotCreatorFromUnified,
  influencerIdFromRefs,
  optionalMetric,
  profileUrlFromHandle,
  shouldReplaceContentFeed,
} from "./creator-snapshot";
import { isInteractiveClientReview } from "./status";
import type {
  ClientAudienceBrief,
  ClientAudienceSlice,
  ClientCreatorBrief,
  ClientHistoricalMonth,
  ClientPerformanceBrief,
  ClientReviewRecord,
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
} from "./types";

function slicesFromDistribution(
  rows: Array<{ label: string; percent: number | null }> | undefined
): ClientAudienceSlice[] {
  if (!rows?.length) return [];
  return rows
    .filter((row) => row.label.trim() && row.percent != null && Number.isFinite(row.percent))
    .map((row) => ({ label: row.label, percent: row.percent as number }))
    .slice(0, 6);
}

function clientAudienceFromBundle(
  bundle: CreatorIntelligenceBundle,
  fallbackInterests: string[]
): ClientAudienceBrief | null {
  const demographics = bundle.audience.windows.last_90_days?.demographics;
  const ages = slicesFromDistribution(demographics?.age);
  const genders = slicesFromDistribution(demographics?.gender);
  const locations = slicesFromDistribution(
    demographics?.countries?.length ? demographics.countries : demographics?.cities
  );
  const interests = [
    ...new Set(
      [
        ...fallbackInterests,
        ...bundle.categoryBrand.businessReadiness.primaryCategories,
      ].filter(Boolean)
    ),
  ].slice(0, 6);
  const qualityLevel = bundle.audience.quality.level;
  const qualityLabel =
    qualityLevel === "High Quality" || qualityLevel === "Good" || qualityLevel === "Monitor"
      ? qualityLevel
      : undefined;
  const growth = bundle.audience.windows.last_90_days?.growth;
  if (
    ages.length === 0 &&
    genders.length === 0 &&
    locations.length === 0 &&
    interests.length === 0 &&
    !qualityLabel &&
    growth?.growthPercent == null &&
    growth?.followerGrowth == null
  ) {
    return null;
  }
  const locationLabel = bundle.audience.geography.primaryCountries[0];
  const summaryParts = [
    locationLabel,
    ages[0] ? `Ages ${ages[0].label}` : null,
    genders[0] ? genders[0].label : null,
  ].filter((part): part is string => Boolean(part));
  return {
    frozenAt: bundle.computedAt,
    ages,
    genders,
    locations,
    interests,
    summary: summaryParts.length > 0 ? summaryParts.join(" · ") : undefined,
    qualityLabel,
    qualityIndicators: (bundle.audience.quality.supportedIndicators ?? [])
      .map((item) => clientSafeFitCopy(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 8),
    growthPercent:
      growth?.growthPercent != null && Number.isFinite(growth.growthPercent)
        ? growth.growthPercent
        : undefined,
    followerGrowth:
      growth?.followerGrowth != null && Number.isFinite(growth.followerGrowth)
        ? growth.followerGrowth
        : undefined,
    growthTrend:
      growth?.growthTrend && growth.growthTrend !== "Unknown" ? growth.growthTrend : undefined,
  };
}

function clientPerformanceFromCreator(
  creator: ClientReviewSourceSnapshotCreator,
  bundle?: CreatorIntelligenceBundle | null
): ClientPerformanceBrief | null {
  const metrics = bundle?.performance.windows.last_90_days?.metrics ?? [];
  const metricValue = (key: string) =>
    optionalMetric(metrics.find((metric) => metric.key === key)?.value);
  const feedAvg = (key: "likes" | "comments" | "views") => {
    const values = (creator.contentFeed ?? [])
      .map((post) => post[key])
      .filter((value): value is number => value != null && Number.isFinite(value));
    if (values.length === 0) return undefined;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };
  const avgLikes = creator.avgLikes ?? metricValue("likes") ?? feedAvg("likes");
  const avgComments = creator.avgComments ?? metricValue("comments") ?? feedAvg("comments");
  const avgViews = creator.avgViews ?? metricValue("views") ?? feedAvg("views");
  const engagementRate = creator.engagementRate ?? metricValue("engagement_rate");
  const estimatedReach = creator.estimatedReach ?? metricValue("reach");
  if (
    avgLikes == null &&
    avgComments == null &&
    avgViews == null &&
    engagementRate == null &&
    estimatedReach == null
  ) {
    return null;
  }
  const frozenAt = bundle?.computedAt ?? creator.briefFrozenAt ?? new Date().toISOString();
  return {
    frozenAt,
    avgLikes,
    avgComments,
    avgViews,
    engagementRate,
    estimatedReach,
    likesExplanation: avgLikes != null ? "Average likes on recent available content." : undefined,
    commentsExplanation:
      avgComments != null ? "Average comments on recent available content." : undefined,
    viewsExplanation: avgViews != null ? "Average views on recent available content." : undefined,
    engagementExplanation:
      engagementRate != null ? "Based on recent available content." : undefined,
    reachExplanation:
      estimatedReach != null ? "Estimated from this creator's available performance." : undefined,
  };
}

function brandMentionsFromBundle(bundle: CreatorIntelligenceBundle | null | undefined): string[] {
  if (!bundle?.categoryBrand.brands.length) return [];
  return bundle.categoryBrand.brands
    .filter((brand) => brand.brandName.trim() && brand.mentionCount > 0)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .map((brand) => brand.brandName)
    .slice(0, 8);
}

function clientHistoricalFromBundle(
  bundle: CreatorIntelligenceBundle | null | undefined
): ClientHistoricalMonth[] {
  if (!bundle?.historical.months.length) return [];
  return bundle.historical.months.slice(-12).map((month) => ({
    periodMonth: month.periodMonth,
    followers: optionalMetric(month.followers),
    following: optionalMetric(month.following),
    postsCount: optionalMetric(month.postsCount),
    engagementRate: optionalMetric(month.engagementRate),
    avgViews: optionalMetric(month.avgViews),
    monthlyGrowthRate: optionalMetric(month.monthlyGrowthRate),
  }));
}

function campaignFitCopy(creator: ClientReviewSourceSnapshotCreator): string | undefined {
  if (creator.matchExplanation || creator.fitExplanation) {
    return creator.matchExplanation || creator.fitExplanation;
  }
  const parts: string[] = [];
  if (creator.country) {
    parts.push(`Audience presence in ${creator.country}`);
  }
  if (creator.category || creator.niche) {
    parts.push(`relevant ${(creator.niche || creator.category || "").toLowerCase()} content`);
  }
  if (creator.engagementRate != null && creator.engagementRate > 0) {
    parts.push("measurable engagement on recent content");
  }
  if (parts.length === 0) return undefined;
  return clientSafeFitCopy(parts.join(", ") + ".");
}

export function briefFromSnapshotCreator(
  creator: ClientReviewSourceSnapshotCreator
): ClientCreatorBrief {
  const contentFeed = creator.contentFeed ?? [];
  return {
    creatorId: creator.creatorId,
    displayName: creator.displayName,
    handle: creator.handle,
    platform: creator.platform,
    platformAccounts: creator.platformAccounts,
    location: formatLocation(creator.city, creator.country),
    bio: creator.bio,
    notes: creator.notes,
    followers: creator.followers,
    engagementRate: creator.engagementRate,
    avatarUrl: creator.avatarUrl,
    profileUrl: creator.profileUrl,
    audience: creator.audience ?? null,
    performance: creator.performance ?? clientPerformanceFromCreator(creator),
    historical: creator.historical ?? [],
    contentFeed,
    campaignFit: campaignFitCopy(creator),
    categories: creator.categories?.length
      ? creator.categories
      : creator.category
        ? [creator.category]
        : [],
    niche: creator.niche,
    brandMentions: creator.brandMentions ?? [],
    matchPercent: creator.matchPercent,
    matchConfidence: creator.matchConfidence,
    matchExplanation: creator.matchExplanation || creator.fitExplanation,
    matchEvidence: creator.matchEvidence ?? [],
    deliverableItems: creator.deliverableItems ?? parseDeliverableItems([]),
    deliverables: creator.deliverables,
    investmentAmount: creator.investmentAmount,
    investmentCurrency: creator.investmentCurrency,
    frozen: Boolean(creator.briefFrozenAt),
  };
}

async function loadStoredCreatorContext(
  supabase: SupabaseClient,
  creator: ClientReviewSourceSnapshotCreator
): Promise<{
  enriched: ClientReviewSourceSnapshotCreator;
  bundle: CreatorIntelligenceBundle | null;
  loaded: boolean;
}> {
  let enriched = creator;
  let loaded = false;
  try {
    const lookup = await resolveUnifiedCreatorsByRefs(
      supabase as never,
      {
        unifiedIds: [creator.creatorId],
        influencerIds: [creator.influencerId ?? influencerIdFromRefs({ creatorId: creator.creatorId })],
        discoveredProfileIds: [
          creator.creatorId.startsWith("dis:") ? creator.creatorId.slice(4) : undefined,
        ],
      },
      { omitHeavyFields: false }
    );
    const unified = resolveCreatorFromRefLookup(lookup, {
      unified_id: creator.creatorId,
      influencer_id: creator.influencerId ?? null,
      profile_id: creator.creatorId.startsWith("dis:") ? creator.creatorId.slice(4) : null,
    });
    if (unified) {
      enriched = enrichSnapshotCreatorFromUnified(creator, unified);
      loaded = true;
    }
  } catch {
    enriched = creator;
  }

  const influencerId = influencerIdFromRefs({
    influencerId: enriched.influencerId,
    creatorId: enriched.creatorId,
  });
  if (!influencerId) return { enriched, bundle: null, loaded };
  try {
    const bundle = await loadCreatorIntelligenceBundle(supabase, {
      influencerId,
      platform: enriched.platform ?? null,
    });
    return { enriched, bundle, loaded: true };
  } catch {
    return { enriched, bundle: null, loaded };
  }
}

export function mergeFrozenBrief(
  creator: ClientReviewSourceSnapshotCreator,
  live: {
    enriched: ClientReviewSourceSnapshotCreator;
    bundle: CreatorIntelligenceBundle | null;
  }
): ClientReviewSourceSnapshotCreator {
  const frozenAt = new Date().toISOString();
  const audience =
    creator.audience ??
    (live.bundle
      ? clientAudienceFromBundle(live.bundle, live.enriched.categories ?? []) ?? undefined
      : undefined);
  const performance =
    creator.performance ??
    clientPerformanceFromCreator(live.enriched, live.bundle) ??
    undefined;
  const brandMentions =
    creator.brandMentions?.length
      ? creator.brandMentions
      : brandMentionsFromBundle(live.bundle);
  const contentFeed = shouldReplaceContentFeed(creator.contentFeed, live.enriched.contentFeed)
    ? live.enriched.contentFeed
    : creator.contentFeed;
  const historical = creator.historical?.length
    ? creator.historical
    : clientHistoricalFromBundle(live.bundle);
  const fit = campaignFitCopy({
    ...live.enriched,
    ...creator,
    matchExplanation: creator.matchExplanation || live.enriched.fitExplanation,
  });
  return {
    ...creator,
    ...live.enriched,
    creatorId: creator.creatorId,
    displayName: creator.displayName || live.enriched.displayName,
    investmentAmount: creator.investmentAmount,
    investmentCurrency: creator.investmentCurrency,
    deliverables: creator.deliverables,
    deliverableItems: creator.deliverableItems,
    matchPercent: creator.matchPercent,
    matchConfidence: creator.matchConfidence,
    matchExplanation: creator.matchExplanation || fit,
    fitExplanation: creator.fitExplanation || fit,
    audience,
    performance,
    historical: historical.length > 0 ? historical : undefined,
    brandMentions: brandMentions.length > 0 ? brandMentions : undefined,
    contentFeed,
    briefFrozenAt: frozenAt,
    briefBackfillDone: true,
  };
}

function needsClientBriefBackfill(creator: ClientReviewSourceSnapshotCreator): boolean {
  if (!creator.profileUrl?.trim() && profileUrlFromHandle(creator.handle, creator.platform)) {
    return true;
  }
  if (!creator.platformAccounts?.length) {
    const platforms = summarizeCreatorDeliverables(creator.deliverableItems).platforms;
    if (platforms.length > 1) return true;
  }
  if (creator.briefBackfillDone) return false;
  if (!creator.contentFeed?.length) return true;
  if (
    creator.contentFeed.every(
      (post) => post.likes == null && post.comments == null && post.views == null
    )
  ) {
    return true;
  }
  if (!creator.audience) return true;
  if (!creator.historical?.length) return true;
  if (!creator.performance) return true;
  if (!creator.bio?.trim()) return true;
  return false;
}

export async function freezeCreatorBriefIfNeeded(
  review: ClientReviewRecord,
  creatorId: string
): Promise<ClientCreatorBrief | null> {
  const snapshot = review.sourceSnapshot;
  if (!snapshot) return null;
  const index = snapshot.creators.findIndex((creator) => creator.creatorId === creatorId);
  if (index < 0) return null;
  const current = snapshot.creators[index]!;
  if (current.briefFrozenAt && !needsClientBriefBackfill(current)) {
    return briefFromSnapshotCreator(current);
  }

  if (!isInteractiveClientReview(review.status)) {
    return briefFromSnapshotCreator(current);
  }

  const service = tryCreateServiceRoleClient().client;
  if (!service) return briefFromSnapshotCreator(current);

  const live = await loadStoredCreatorContext(service, current);
  if (!live.loaded) return briefFromSnapshotCreator(current);
  const frozen = mergeFrozenBrief(current, live);
  const nextSnapshot: ClientReviewSourceSnapshot = {
    ...snapshot,
    creators: snapshot.creators.map((creator, idx) => (idx === index ? frozen : creator)),
  };
  await service
    .from("campaign_client_reviews" as never)
    .update({
      source_snapshot: nextSnapshot,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", review.id);

  return briefFromSnapshotCreator(frozen);
}
