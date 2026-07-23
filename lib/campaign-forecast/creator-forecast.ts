import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import { buildConfidenceScore, explainConfidence } from "./confidence";
import {
  aggregateDeliverablesByPlatform,
  applyCrossPlatformOverlap,
} from "./cross-platform";
import {
  defaultDeliverableForPlatform,
  forecastDeliverable,
} from "./deliverable-forecast";
import { buildHistoricalPerformanceFromCreator } from "./forecast-strategy";
import type {
  CampaignForecastCreatorInput,
  CampaignForecastDeliverableInput,
  CreatorForecast,
  DeliverableForecast,
  ForecastAssumptions,
  ForecastStrategy,
} from "./types";
import { CAMPAIGN_FORECAST_ENGINE_VERSION } from "./types";

function positiveFollowers(followers: number | null | undefined): number | null {
  if (followers == null || !Number.isFinite(followers) || followers <= 0) return null;
  return followers;
}

function resolveCreatorPlatform(
  creator: CampaignForecastCreatorInput,
  campaignPlatform?: string | null
): string | null {
  if (campaignPlatform) return canonicalPlatformKey(campaignPlatform);
  if (creator.platform) return canonicalPlatformKey(creator.platform);
  if (creator.primaryPlatform) return canonicalPlatformKey(creator.primaryPlatform);
  return null;
}

function expandDeliverables(
  creator: CampaignForecastCreatorInput,
  platform: string | null
): CampaignForecastDeliverableInput[] {
  if (creator.deliverables?.length) {
    return creator.deliverables.map((deliverable) => ({
      ...deliverable,
      platform: deliverable.platform ?? platform,
      quantity: deliverable.quantity ?? 1,
    }));
  }
  return [defaultDeliverableForPlatform(platform)];
}

function primaryStrategy(
  deliverables: DeliverableForecast[]
): ForecastStrategy {
  const priority: ForecastStrategy[] = [
    "historical_performance",
    "similar_creator_benchmark",
    "platform_benchmark",
    "generic_multiplier",
  ];
  for (const strategy of priority) {
    if (deliverables.some((item) => item.forecastStrategy === strategy)) return strategy;
  }
  return "generic_multiplier";
}

function buildCreatorExplanation(input: {
  displayName?: string | null;
  handle?: string | null;
  followers: number;
  platform: string | null;
  deliverableForecasts: CreatorForecast["deliverableForecasts"];
  crossPlatform: ReturnType<typeof applyCrossPlatformOverlap>;
  totals: Pick<
    CreatorForecast,
    | "grossReach"
    | "estimatedReach"
    | "estimatedImpressions"
    | "estimatedViews"
    | "estimatedEngagements"
  >;
  primaryForecastStrategy: ForecastStrategy;
  confidenceLines: string[];
}): string[] {
  const label = input.displayName ?? input.handle ?? "Creator";
  const bullets: string[] = [
    `${label}: audience size ${input.followers.toLocaleString()} followers.`,
    `Primary forecast strategy: ${input.primaryForecastStrategy}.`,
  ];

  for (const deliverable of input.deliverableForecasts) {
    bullets.push(
      `${deliverable.contentType} ×${deliverable.quantity} (${deliverable.platform}): reach ${deliverable.estimatedReach.toLocaleString()} via ${deliverable.forecastStrategy}.`
    );
  }

  bullets.push(...input.crossPlatform.explanation);
  bullets.push(
    `Creator gross reach ${input.totals.grossReach.toLocaleString()} → net reach ${input.totals.estimatedReach.toLocaleString()} after cross-platform overlap.`
  );
  bullets.push(
    `Impressions ${input.totals.estimatedImpressions.toLocaleString()}, views ${input.totals.estimatedViews.toLocaleString()}, engagements ${input.totals.estimatedEngagements.toLocaleString()}.`
  );
  bullets.push(...input.confidenceLines);
  return bullets;
}

export function forecastCreator(
  creator: CampaignForecastCreatorInput,
  campaignPlatform?: string | null,
  crossPlatformOverlapRate?: number
): CreatorForecast | null {
  const followers = positiveFollowers(creator.followers);
  if (followers == null) return null;

  const platform = resolveCreatorPlatform(creator, campaignPlatform);
  const deliverableInputs = expandDeliverables(creator, platform);
  const historical = buildHistoricalPerformanceFromCreator(creator);

  const deliverableForecasts = deliverableInputs
    .map((deliverable) =>
      forecastDeliverable({
        followers,
        platform,
        campaignPlatform,
        deliverable,
        engagementRate: creator.engagementRate,
        creator,
        historical,
      })
    )
    .filter((forecast): forecast is NonNullable<typeof forecast> => forecast != null);

  if (!deliverableForecasts.length) return null;

  const reachByPlatform = aggregateDeliverablesByPlatform(
    deliverableForecasts.map((item) => ({
      platform: item.platform,
      estimatedReach: item.estimatedReach,
    }))
  );
  const crossPlatform = applyCrossPlatformOverlap({
    deliverableReachByPlatform: reachByPlatform,
    overlapRate: crossPlatformOverlapRate,
  });

  const grossReach = crossPlatform.grossReach;
  const estimatedReach = crossPlatform.netReach;
  const estimatedImpressions = deliverableForecasts.reduce(
    (sum, item) => sum + item.estimatedImpressions,
    0
  );
  const estimatedViews = deliverableForecasts.reduce(
    (sum, item) => sum + item.estimatedViews,
    0
  );
  const estimatedEngagements = deliverableForecasts.reduce(
    (sum, item) => sum + item.estimatedEngagements,
    0
  );

  const primaryForecastStrategy = primaryStrategy(deliverableForecasts);
  const historicalSampleSize = historical?.sampleSize ?? 0;

  const confidence = buildConfidenceScore({
    creator,
    hasFollowers: true,
    hasEngagementRate: creator.engagementRate != null,
    hasPlatform: platform != null,
    hasDeliverables: deliverableForecasts.length > 0,
    followerCount: followers,
    forecastStrategy: primaryForecastStrategy,
    historicalSampleSize,
  });

  const primaryDeliverable = deliverableForecasts[0]!;
  const assumptions: ForecastAssumptions = {
    ...primaryDeliverable.assumptions,
    deliverables: deliverableForecasts.reduce((sum, item) => sum + item.quantity, 0),
    forecastStrategy: primaryForecastStrategy,
    calculationMethod: CAMPAIGN_FORECAST_ENGINE_VERSION,
    crossPlatformOverlapDeduction: crossPlatform.overlapDeduction,
  };

  const totals = {
    grossReach,
    estimatedReach,
    estimatedImpressions,
    estimatedViews,
    estimatedEngagements,
  };

  const platforms = [
    ...new Set(deliverableForecasts.map((item) => canonicalPlatformKey(item.platform))),
  ];

  return {
    creatorKey: creator.creatorKey,
    displayName: creator.displayName ?? null,
    handle: creator.handle ?? null,
    platform,
    platforms,
    followers,
    audienceSize: followers,
    crossPlatformOverlapDeduction: crossPlatform.overlapDeduction,
    ...totals,
    engagementRate: creator.engagementRate ?? null,
    primaryForecastStrategy,
    deliverableForecasts,
    assumptions,
    confidence,
    explanation: buildCreatorExplanation({
      displayName: creator.displayName,
      handle: creator.handle,
      followers,
      platform,
      deliverableForecasts,
      crossPlatform,
      totals,
      primaryForecastStrategy,
      confidenceLines: explainConfidence(confidence),
    }),
  };
}

export function deduplicateCreators(
  creators: CampaignForecastCreatorInput[]
): CampaignForecastCreatorInput[] {
  const byKey = new Map<string, CampaignForecastCreatorInput>();

  for (const creator of creators) {
    const existing = byKey.get(creator.creatorKey);
    if (!existing) {
      byKey.set(creator.creatorKey, { ...creator });
      continue;
    }

    const mergedDeliverables = [
      ...(existing.deliverables ?? []),
      ...(creator.deliverables ?? []),
    ];
    const mergedCategories = [
      ...new Set([...(existing.categories ?? []), ...(creator.categories ?? [])]),
    ];
    const mergedCountries = [
      ...new Set([...(existing.countryCodes ?? []), ...(creator.countryCodes ?? [])]),
    ];

    byKey.set(creator.creatorKey, {
      ...existing,
      followers: Math.max(existing.followers ?? 0, creator.followers ?? 0) || null,
      engagementRate: existing.engagementRate ?? creator.engagementRate ?? null,
      platform: existing.platform ?? creator.platform ?? creator.primaryPlatform ?? null,
      categories: mergedCategories.length ? mergedCategories : undefined,
      countryCodes: mergedCountries.length ? mergedCountries : undefined,
      countryCode: existing.countryCode ?? creator.countryCode ?? null,
      niche: existing.niche ?? creator.niche ?? null,
      deliverables: mergedDeliverables.length ? mergedDeliverables : undefined,
      historicalPerformance: existing.historicalPerformance ?? creator.historicalPerformance,
      recentPublicationMetrics: [
        ...(existing.recentPublicationMetrics ?? []),
        ...(creator.recentPublicationMetrics ?? []),
      ],
    });
  }

  return [...byKey.values()];
}
