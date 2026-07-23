import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { computeImpressionsForecast } from "@/lib/performance/impressions-forecast-engine";
import {
  computeEngagementSnapshot,
  type EngagementRateInput,
} from "@/lib/performance/engagement-rate-engine";
import {
  computeReachForecast,
  reachMultiplierForContentType,
} from "@/lib/performance/reach-forecast-engine";

import { resolveSimilarCreatorBenchmark } from "./audience-overlap";
import { deliverableDecayMultiplier, explainDeliverableDecay } from "./deliverable-decay";
import {
  buildHistoricalPerformanceFromCreator,
  selectReachEstimate,
  type CreatorHistoricalPerformanceInput,
} from "./forecast-strategy";
import type {
  CampaignForecastCreatorInput,
  CampaignForecastDeliverableInput,
  DeliverableForecast,
  ForecastAssumptions,
} from "./types";
import { CAMPAIGN_FORECAST_ENGINE_VERSION } from "./types";
import { platformBenchmarkReach } from "./audience-overlap";

/** Views-to-reach ratio by content category (forecast when views unavailable). */
const VIEW_TO_REACH_RATIO: Record<string, number> = {
  instagram_reel: 1.2,
  ig_reel: 1.2,
  reel: 1.2,
  tiktok_video: 1.25,
  tt_video: 1.25,
  youtube_short: 1.15,
  yt_short: 1.15,
  youtube_video: 1.1,
  yt_video: 1.1,
  instagram_story: 0.85,
  ig_story: 0.85,
  story: 0.85,
  tiktok_story: 0.9,
  instagram_post: 1.0,
  ig_post: 1.0,
  photo: 1.0,
  carousel: 1.0,
};

function positiveFollowers(followers: number | null | undefined): number | null {
  if (followers == null || !Number.isFinite(followers) || followers <= 0) return null;
  return followers;
}

function normalizeContentType(
  contentType: string | null | undefined,
  platform: string | null | undefined
): string {
  const type = (contentType ?? "").trim().toLowerCase();
  if (type) return type;

  const platformKey = canonicalPlatformKey(platform ?? "");
  if (platformKey === "instagram") return "instagram_post";
  if (platformKey === "tiktok") return "tiktok_video";
  if (platformKey === "youtube") return "youtube_video";
  return type;
}

function viewToReachRatio(contentType: string): number {
  return VIEW_TO_REACH_RATIO[contentType] ?? 1.0;
}

function resolvePlatform(
  deliverablePlatform: string | null | undefined,
  creatorPlatform: string | null | undefined,
  campaignPlatform: string | null | undefined
): string {
  const resolved = deliverablePlatform ?? campaignPlatform ?? creatorPlatform ?? "instagram";
  return canonicalPlatformKey(resolved) || "instagram";
}

export function defaultDeliverableForPlatform(
  platform: string | null | undefined
): CampaignForecastDeliverableInput {
  const platformKey = canonicalPlatformKey(platform ?? "");
  if (platformKey === "tiktok") {
    return { contentType: "tiktok_video", platform: platformKey, quantity: 1 };
  }
  if (platformKey === "youtube") {
    return { contentType: "youtube_video", platform: platformKey, quantity: 1 };
  }
  return { contentType: "instagram_post", platform: platformKey || "instagram", quantity: 1 };
}

export function forecastDeliverable(input: {
  followers: number;
  platform: string | null | undefined;
  campaignPlatform?: string | null;
  deliverable: CampaignForecastDeliverableInput;
  engagementRate?: number | null;
  creator?: CampaignForecastCreatorInput;
  historical?: CreatorHistoricalPerformanceInput | null;
}): DeliverableForecast | null {
  const followers = positiveFollowers(input.followers);
  if (followers == null) return null;

  const platform = resolvePlatform(
    input.deliverable.platform,
    input.platform,
    input.campaignPlatform
  );
  const contentType = normalizeContentType(
    input.deliverable.contentType ?? input.deliverable.publicationType,
    platform
  );
  const quantity = Math.max(1, Math.floor(input.deliverable.quantity ?? 1));

  const reachMultiplier = reachMultiplierForContentType(platform, contentType);
  const genericReach = computeReachForecast({
    followers,
    platform,
    publication_type: contentType,
  }).forecastReach;

  const historical =
    input.historical ?? buildHistoricalPerformanceFromCreator(input.creator ?? { creatorKey: "inline" });

  const reachSelection = selectReachEstimate({
    followers,
    platform,
    contentType,
    reachMultiplier,
    genericReach,
    platformBenchmarkReach: platformBenchmarkReach(followers, platform),
    similarCreatorReach: input.creator
      ? resolveSimilarCreatorBenchmark({
          followers,
          platform,
          categories: input.creator.categories,
          niche: input.creator.niche,
        })
      : null,
    historical,
  });

  if (reachSelection.baseReach <= 0) return null;

  const decayMultiplier = deliverableDecayMultiplier(contentType, quantity);
  const estimatedReach = Math.round(reachSelection.baseReach * decayMultiplier);
  const estimatedViews = Math.round(
    estimatedReach * viewToReachRatio(contentType) * Math.max(1, quantity * 0.85)
  );

  const impressionsResult = computeImpressionsForecast({
    platform,
    publication_type: contentType,
    views: estimatedViews,
    effectiveReach: estimatedReach,
  });
  const estimatedImpressions =
    impressionsResult.forecastImpressions ?? Math.round(estimatedViews * 1.05);

  const engagementInput: EngagementRateInput = {
    followers,
    reach: estimatedReach,
    views: estimatedViews,
    manualEngagementRate: input.engagementRate ?? historical?.avgEngagementRate ?? null,
  };
  const engagementSnapshot = computeEngagementSnapshot(engagementInput);
  const er = input.engagementRate ?? historical?.avgEngagementRate ?? null;
  const estimatedEngagements =
    engagementSnapshot.engagements > 0
      ? Math.round(engagementSnapshot.engagements)
      : er != null
        ? Math.round((estimatedViews * er) / 100)
        : 0;

  const assumptions: ForecastAssumptions = {
    reachMultiplier,
    contentType,
    platform,
    deliverables: quantity,
    engagementRate: er,
    forecastStrategy: reachSelection.strategy,
    calculationMethod: CAMPAIGN_FORECAST_ENGINE_VERSION,
    decayMultiplier,
    strategyLabel: reachSelection.strategyLabel,
    historicalSampleSize: reachSelection.usedHistoricalSampleSize,
    viewToReachRatio: viewToReachRatio(contentType),
    impressionsFormula: impressionsResult.formula,
  };

  return {
    contentType,
    platform,
    quantity,
    estimatedReach,
    estimatedImpressions,
    estimatedViews,
    estimatedEngagements,
    reachMultiplier,
    forecastStrategy: reachSelection.strategy,
    assumptions,
  };
}

export function explainDeliverableForecast(
  forecast: DeliverableForecast,
  baseReach: number
): string[] {
  return [
    `Strategy: ${forecast.forecastStrategy} — ${forecast.assumptions.strategyLabel ?? "selected automatically"}.`,
    ...explainDeliverableDecay(forecast.contentType, forecast.quantity),
    `Base reach ${baseReach.toLocaleString()} × decay ${forecast.assumptions.decayMultiplier} = ${forecast.estimatedReach.toLocaleString()}.`,
  ];
}
