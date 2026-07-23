import { applyCampaignAudienceOverlap } from "./audience-overlap";
import { explainConfidence, aggregateConfidence } from "./confidence";
import { DEFAULT_OVERLAP_CONFIG } from "./config";
import { deduplicateCreators, forecastCreator } from "./creator-forecast";
import type {
  CampaignCalculationSummary,
  CampaignForecast,
  CampaignForecastInput,
  CampaignForecastOverlapConfig,
  CampaignForecastSnapshot,
  ForecastAssumptions,
} from "./types";
import { CAMPAIGN_FORECAST_ENGINE_VERSION } from "./types";

function resolveOverlapConfig(
  input?: CampaignForecastOverlapConfig
): Required<CampaignForecastOverlapConfig> {
  return {
    defaultPairOverlapRate:
      input?.defaultPairOverlapRate ?? DEFAULT_OVERLAP_CONFIG.defaultPairOverlapRate,
    maxPairOverlapRate: input?.maxPairOverlapRate ?? DEFAULT_OVERLAP_CONFIG.maxPairOverlapRate,
    crossPlatformOverlapRate:
      input?.crossPlatformOverlapRate ?? DEFAULT_OVERLAP_CONFIG.crossPlatformOverlapRate,
    defaultCampaignOverlapPerCreator:
      input?.defaultCampaignOverlapPerCreator ??
      DEFAULT_OVERLAP_CONFIG.defaultCampaignOverlapPerCreator,
  };
}

function averageEngagementRate(
  creatorForecasts: CampaignForecast["creatorForecasts"]
): number | null {
  const rates = creatorForecasts
    .map((creator) => creator.engagementRate)
    .filter((rate): rate is number => rate != null && Number.isFinite(rate));

  if (!rates.length) return null;
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

function buildCalculationSummary(input: {
  creatorForecasts: CampaignForecast["creatorForecasts"];
  overlap: ReturnType<typeof applyCampaignAudienceOverlap>;
}): CampaignCalculationSummary {
  const platforms = [
    ...new Set(
      input.creatorForecasts.flatMap((creator) => creator.platforms).filter(Boolean)
    ),
  ];
  const totalDeliverables = input.creatorForecasts.reduce(
    (sum, creator) =>
      sum + creator.deliverableForecasts.reduce((inner, item) => inner + item.quantity, 0),
    0
  );

  const audienceSize = input.creatorForecasts.reduce(
    (sum, creator) => sum + creator.audienceSize,
    0
  );

  const bullets = [
    `Audience size ${audienceSize.toLocaleString()} = deduplicated creator followers.`,
    ...input.overlap.explanation,
    `Estimated impressions ${input.creatorForecasts.reduce((sum, c) => sum + c.estimatedImpressions, 0).toLocaleString()} = sum of deliverable impressions (independent metric).`,
    `Estimated views ${input.creatorForecasts.reduce((sum, c) => sum + c.estimatedViews, 0).toLocaleString()} and engagements ${input.creatorForecasts.reduce((sum, c) => sum + c.estimatedEngagements, 0).toLocaleString()} aggregated from creator forecasts.`,
    `${input.creatorForecasts.length} unique creators, ${totalDeliverables} deliverable units across ${platforms.join(", ") || "default platforms"}.`,
  ];

  return {
    uniqueCreators: input.creatorForecasts.length,
    totalDeliverables,
    platforms,
    aggregationMethod: "deduplicated_creators_with_overlap",
    overlap: {
      grossReach: input.overlap.grossReach,
      overlapDeduction: input.overlap.overlapDeduction,
      netReach: input.overlap.estimatedReach,
      pairCount: input.overlap.pairwiseAdjustments.length,
    },
    bullets,
  };
}

function emptyForecast(): CampaignForecast {
  return {
    audienceSize: 0,
    grossReach: 0,
    overlapDeduction: 0,
    estimatedReach: 0,
    estimatedImpressions: 0,
    estimatedViews: 0,
    estimatedEngagements: 0,
    averageEngagementRate: null,
    creatorForecasts: [],
    calculationSummary: {
      uniqueCreators: 0,
      totalDeliverables: 0,
      platforms: [],
      aggregationMethod: "deduplicated_creators_with_overlap",
      overlap: { grossReach: 0, overlapDeduction: 0, netReach: 0, pairCount: 0 },
      bullets: ["No creators with follower data available for forecasting."],
    },
    assumptions: {
      calculationMethod: CAMPAIGN_FORECAST_ENGINE_VERSION,
    },
    confidenceScore: { score: 0, label: "low", deductions: [], bonuses: [] },
    explanation: ["No forecast produced — missing creator follower data."],
  };
}

/**
 * Unified Campaign Forecast Engine — the only allowed entry point for roster-based
 * campaign forecasting metrics across Thinkway.
 */
export function computeCampaignForecast(input: CampaignForecastInput): CampaignForecast {
  const overlapConfig = resolveOverlapConfig(input.overlapConfig);
  const dedupedCreators = deduplicateCreators(input.creators);

  const creatorForecasts = dedupedCreators
    .map((creator) =>
      forecastCreator(creator, input.campaignPlatform, overlapConfig.crossPlatformOverlapRate)
    )
    .filter((forecast): forecast is NonNullable<typeof forecast> => forecast != null);

  if (!creatorForecasts.length) {
    return emptyForecast();
  }

  const creatorReachByKey = new Map(
    creatorForecasts.map((creator) => [creator.creatorKey, creator.estimatedReach])
  );
  const overlap = applyCampaignAudienceOverlap({
    creatorInputs: dedupedCreators,
    creatorReachByKey,
    config: overlapConfig,
  });

  const audienceSize = creatorForecasts.reduce((sum, creator) => sum + creator.audienceSize, 0);
  const estimatedImpressions = creatorForecasts.reduce(
    (sum, creator) => sum + creator.estimatedImpressions,
    0
  );
  const estimatedViews = creatorForecasts.reduce(
    (sum, creator) => sum + creator.estimatedViews,
    0
  );
  const estimatedEngagements = creatorForecasts.reduce(
    (sum, creator) => sum + creator.estimatedEngagements,
    0
  );

  const calculationSummary = buildCalculationSummary({ creatorForecasts, overlap });
  const campaignConfidence = aggregateConfidence(
    creatorForecasts.map((creator) => creator.confidence)
  );

  const assumptions: ForecastAssumptions = {
    calculationMethod: CAMPAIGN_FORECAST_ENGINE_VERSION,
    uniqueCreators: calculationSummary.uniqueCreators,
    totalDeliverables: calculationSummary.totalDeliverables,
    campaignPlatform: input.campaignPlatform ?? null,
    grossReach: overlap.grossReach,
    overlapDeduction: overlap.overlapDeduction,
  };

  const explanation = [
    ...calculationSummary.bullets,
    ...explainConfidence(campaignConfidence),
  ];

  return {
    audienceSize,
    grossReach: overlap.grossReach,
    overlapDeduction: overlap.overlapDeduction,
    estimatedReach: overlap.estimatedReach,
    estimatedImpressions,
    estimatedViews,
    estimatedEngagements,
    averageEngagementRate: averageEngagementRate(creatorForecasts),
    creatorForecasts,
    calculationSummary,
    assumptions,
    confidenceScore: campaignConfidence,
    explanation,
  };
}

export function explainCreatorForecastStepByStep(
  forecast: CampaignForecast,
  creatorKey: string
): string[] {
  const creator = forecast.creatorForecasts.find((item) => item.creatorKey === creatorKey);
  if (!creator) return [`Creator ${creatorKey} not found in forecast.`];
  return creator.explanation;
}

export function toCampaignForecastSnapshot(forecast: CampaignForecast): CampaignForecastSnapshot {
  return {
    engineVersion: CAMPAIGN_FORECAST_ENGINE_VERSION,
    audienceSize: forecast.audienceSize,
    grossReach: forecast.grossReach,
    overlapDeduction: forecast.overlapDeduction,
    estimatedReach: forecast.estimatedReach,
    estimatedImpressions: forecast.estimatedImpressions,
    estimatedViews: forecast.estimatedViews,
    estimatedEngagements: forecast.estimatedEngagements,
    averageEngagementRate: forecast.averageEngagementRate,
    confidenceScore: forecast.confidenceScore.score,
    confidenceLabel: forecast.confidenceScore.label,
    explanation: [...forecast.explanation],
    computedAt: new Date().toISOString(),
  };
}

export function fromCampaignForecastSnapshot(
  snapshot: CampaignForecastSnapshot
): Pick<
  CampaignForecast,
  | "audienceSize"
  | "grossReach"
  | "overlapDeduction"
  | "estimatedReach"
  | "estimatedImpressions"
  | "estimatedViews"
  | "estimatedEngagements"
  | "averageEngagementRate"
> {
  return {
    audienceSize: snapshot.audienceSize,
    grossReach: snapshot.grossReach,
    overlapDeduction: snapshot.overlapDeduction,
    estimatedReach: snapshot.estimatedReach,
    estimatedImpressions: snapshot.estimatedImpressions,
    estimatedViews: snapshot.estimatedViews,
    estimatedEngagements: snapshot.estimatedEngagements,
    averageEngagementRate: snapshot.averageEngagementRate,
  };
}
