import type { CampaignForecastCreatorInput } from "./types";

export type ForecastStrategy =
  | "historical_performance"
  | "similar_creator_benchmark"
  | "platform_benchmark"
  | "generic_multiplier";

export type CreatorHistoricalPerformanceInput = {
  avgReachByContentType?: Record<string, number>;
  avgViewsByContentType?: Record<string, number>;
  avgReach?: number | null;
  avgViews?: number | null;
  avgEngagementRate?: number | null;
  sampleSize?: number;
  dataFreshnessDays?: number | null;
  source?: string | null;
};

export type ReachEstimateResult = {
  baseReach: number;
  strategy: ForecastStrategy;
  strategyLabel: string;
  reachMultiplier: number | null;
  usedHistoricalSampleSize: number;
};

function normalizeContentKey(contentType: string): string {
  return contentType.trim().toLowerCase();
}

function historicalReachForContentType(
  historical: CreatorHistoricalPerformanceInput | null | undefined,
  contentType: string
): number | null {
  if (!historical) return null;
  const key = normalizeContentKey(contentType);
  const byType = historical.avgReachByContentType?.[key];
  if (byType != null && byType > 0) return byType;

  const viewsByType = historical.avgViewsByContentType?.[key];
  if (viewsByType != null && viewsByType > 0) return Math.round(viewsByType * 0.92);

  if (historical.avgReach != null && historical.avgReach > 0) return historical.avgReach;
  if (historical.avgViews != null && historical.avgViews > 0) {
    return Math.round(historical.avgViews * 0.92);
  }
  return null;
}

export function selectReachEstimate(input: {
  followers: number;
  platform: string;
  contentType: string;
  reachMultiplier: number | null;
  genericReach: number | null;
  platformBenchmarkReach: number | null;
  similarCreatorReach: number | null;
  historical?: CreatorHistoricalPerformanceInput | null;
}): ReachEstimateResult {
  const historicalReach = historicalReachForContentType(input.historical, input.contentType);
  const sampleSize = input.historical?.sampleSize ?? 0;

  if (historicalReach != null && sampleSize > 0) {
    return {
      baseReach: Math.round(historicalReach),
      strategy: "historical_performance",
      strategyLabel: `Historical average (${sampleSize} samples, ${input.historical?.source ?? "creator data"})`,
      reachMultiplier: input.reachMultiplier,
      usedHistoricalSampleSize: sampleSize,
    };
  }

  if (input.similarCreatorReach != null && input.similarCreatorReach > 0) {
    return {
      baseReach: Math.round(input.similarCreatorReach),
      strategy: "similar_creator_benchmark",
      strategyLabel: "Similar creator benchmark (platform + category adjusted)",
      reachMultiplier: input.reachMultiplier,
      usedHistoricalSampleSize: 0,
    };
  }

  if (input.platformBenchmarkReach != null && input.platformBenchmarkReach > 0) {
    return {
      baseReach: Math.round(input.platformBenchmarkReach),
      strategy: "platform_benchmark",
      strategyLabel: "Platform benchmark reach factor",
      reachMultiplier: input.reachMultiplier,
      usedHistoricalSampleSize: 0,
    };
  }

  return {
    baseReach: input.genericReach ?? 0,
    strategy: "generic_multiplier",
    strategyLabel: "Generic follower × content-type multiplier",
    reachMultiplier: input.reachMultiplier,
    usedHistoricalSampleSize: 0,
  };
}

export function buildHistoricalPerformanceFromCreator(
  creator: CampaignForecastCreatorInput
): CreatorHistoricalPerformanceInput | null {
  if (creator.historicalPerformance) return creator.historicalPerformance;

  const hasInline =
    creator.avgViews != null ||
    creator.avgReach != null ||
    creator.recentPublicationMetrics?.length;
  if (!hasInline) return null;

  const avgReachByContentType: Record<string, number> = {};
  const avgViewsByContentType: Record<string, number> = {};
  const viewsByType = new Map<string, number[]>();
  const reachByType = new Map<string, number[]>();

  for (const publication of creator.recentPublicationMetrics ?? []) {
    const type = normalizeContentKey(publication.contentType ?? "default");
    if (publication.views != null && publication.views > 0) {
      const bucket = viewsByType.get(type) ?? [];
      bucket.push(publication.views);
      viewsByType.set(type, bucket);
    }
    if (publication.reach != null && publication.reach > 0) {
      const bucket = reachByType.get(type) ?? [];
      bucket.push(publication.reach);
      reachByType.set(type, bucket);
    }
  }

  for (const [type, values] of viewsByType) {
    avgViewsByContentType[type] = Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length
    );
  }
  for (const [type, values] of reachByType) {
    avgReachByContentType[type] = Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length
    );
  }

  return {
    avgReachByContentType,
    avgViewsByContentType,
    avgReach: creator.avgReach ?? null,
    avgViews: creator.avgViews ?? null,
    avgEngagementRate: creator.engagementRate ?? null,
    sampleSize: creator.recentPublicationMetrics?.length ?? 0,
    dataFreshnessDays: creator.dataFreshnessDays ?? null,
    source: "recent_publications",
  };
}

export const STRATEGY_PRIORITY: ForecastStrategy[] = [
  "historical_performance",
  "similar_creator_benchmark",
  "platform_benchmark",
  "generic_multiplier",
];

export function strategySelectionMatrix(): Array<{
  scenario: string;
  selectedStrategy: ForecastStrategy;
}> {
  return [
    {
      scenario: "Creator has ≥1 recent publication metrics for content type",
      selectedStrategy: "historical_performance",
    },
    {
      scenario: "Category + platform known, no historical samples",
      selectedStrategy: "similar_creator_benchmark",
    },
    {
      scenario: "Platform known only",
      selectedStrategy: "platform_benchmark",
    },
    {
      scenario: "Followers only",
      selectedStrategy: "generic_multiplier",
    },
  ];
}
