import {
  computeEngagementSnapshot,
  metricsRefreshStatusForEngagement,
  type EngagementRateMethod,
  type MetricsRefreshContext,
} from "@/lib/performance/engagement-rate-engine";
import {
  resolveImpressionsSnapshot,
  type ImpressionsForecastMethod,
  type ImpressionsSource,
} from "@/lib/performance/impressions-forecast-engine";
import {
  resolveReachSnapshot,
  type ReachForecastConfidence,
  type ReachForecastMethod,
  type ReachSource,
} from "@/lib/performance/reach-forecast-engine";
import type { CollectedMetrics, MetricsProviderId } from "@/lib/performance/metrics-collector/types";

export const COLLECTED_METRIC_KEYS = [
  "views",
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "plays",
  "clicks",
] as const satisfies ReadonlyArray<keyof CollectedMetrics>;

/** Apify and some platforms use -1 when a metric is hidden or unavailable. */
export function sanitizeMetricValue(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export type MergeMetricsContext = MetricsRefreshContext & {
  followers?: number | null;
  manualEngagementRate?: number | null;
  engagement_rate_method?: EngagementRateMethod | null;
  reach_source?: ReachSource | null;
  stored_actual_reach?: number | null;
  stored_forecast_reach?: number | null;
  stored_reach?: number | null;
  metrics_source?: MetricsProviderId | null;
  impressions_source?: ImpressionsSource | null;
  stored_actual_impressions?: number | null;
  stored_forecast_impressions?: number | null;
  stored_impressions?: number | null;
};

export type MergedImpressionsFields = {
  impressions_source?: ImpressionsSource | null;
  actual_impressions?: number | null;
  forecast_impressions?: number | null;
  forecast_impressions_method?: ImpressionsForecastMethod | null;
  forecast_impressions_formula?: string | null;
};

export type MergedReachFields = {
  reach_source?: ReachSource | null;
  actual_reach?: number | null;
  forecast_reach?: number | null;
  forecast_confidence?: ReachForecastConfidence | null;
  forecast_method?: ReachForecastMethod | null;
};

export function computeEngagements(metrics: Partial<CollectedMetrics>): number | null {
  const snapshot = computeEngagementSnapshot({
    views: sanitizeMetricValue(metrics.views),
    reach: sanitizeMetricValue(metrics.reach),
    likes: sanitizeMetricValue(metrics.likes),
    comments: sanitizeMetricValue(metrics.comments),
    shares: sanitizeMetricValue(metrics.shares),
    saves: sanitizeMetricValue(metrics.saves),
  });
  return snapshot.engagements > 0 ? snapshot.engagements : null;
}

/** Read stored publication metrics (including legacy engagement_* columns). */
export function storedMetricsFromPublication(
  row: Record<string, unknown>
): Partial<CollectedMetrics> {
  const metrics: Partial<CollectedMetrics> = {};

  for (const key of COLLECTED_METRIC_KEYS) {
    const value = sanitizeMetricValue(row[key]);
    if (value != null) metrics[key] = value;
  }

  if (metrics.views == null) {
    const legacyViews = sanitizeMetricValue(row.engagement_views);
    if (legacyViews != null) metrics.views = legacyViews;
  }
  if (metrics.likes == null) {
    const legacyLikes = sanitizeMetricValue(row.engagement_likes);
    if (legacyLikes != null) metrics.likes = legacyLikes;
  }
  if (metrics.comments == null) {
    const legacyComments = sanitizeMetricValue(row.engagement_comments);
    if (legacyComments != null) metrics.comments = legacyComments;
  }
  if (metrics.shares == null) {
    const legacyShares = sanitizeMetricValue(row.engagement_shares);
    if (legacyShares != null) metrics.shares = legacyShares;
  }

  const storedEngagements = sanitizeMetricValue(row.engagements);
  if (storedEngagements != null) metrics.engagements = storedEngagements;

  const storedEr = row.engagement_rate;
  if (storedEr != null && Number.isFinite(Number(storedEr))) {
    metrics.engagement_rate = Number(storedEr);
  }

  return metrics;
}

export function storedReachContextFromPublication(
  row: Record<string, unknown>
): Pick<
  MergeMetricsContext,
  "reach_source" | "stored_actual_reach" | "stored_forecast_reach" | "stored_reach"
> {
  const reachSource = row.reach_source;
  const storedReach = sanitizeMetricValue(row.reach);
  const storedActualReach = sanitizeMetricValue(row.actual_reach);
  let normalizedSource =
    reachSource === "actual" || reachSource === "forecast" || reachSource === "manual"
      ? reachSource
      : null;
  // Migration default reach_source='actual' on rows with no reach is not a real source.
  if (normalizedSource === "actual" && storedActualReach == null && storedReach == null) {
    normalizedSource = null;
  }
  return {
    reach_source: normalizedSource as ReachSource | null,
    stored_actual_reach: storedActualReach,
    stored_forecast_reach: sanitizeMetricValue(row.forecast_reach),
    stored_reach: storedReach,
  };
}

export function storedImpressionsContextFromPublication(
  row: Record<string, unknown>
): Pick<
  MergeMetricsContext,
  | "impressions_source"
  | "stored_actual_impressions"
  | "stored_forecast_impressions"
  | "stored_impressions"
> {
  const impressionsSource = row.impressions_source;
  const storedImpressions = sanitizeMetricValue(row.impressions);
  const storedActualImpressions = sanitizeMetricValue(row.actual_impressions);
  let normalizedSource =
    impressionsSource === "actual" ||
    impressionsSource === "forecast" ||
    impressionsSource === "manual"
      ? impressionsSource
      : null;
  if (
    normalizedSource === "actual" &&
    storedActualImpressions == null &&
    storedImpressions == null
  ) {
    normalizedSource = null;
  }
  return {
    impressions_source: normalizedSource as ImpressionsSource | null,
    stored_actual_impressions: storedActualImpressions,
    stored_forecast_impressions: sanitizeMetricValue(row.forecast_impressions),
    stored_impressions: storedImpressions,
  };
}

/** Reach is resolved once in persistCollectedMetrics — strip prior merge output before persist. */
export function stripImpressionsFromCollectedMetrics(
  metrics: Partial<CollectedMetrics> & MergedImpressionsFields
): Partial<CollectedMetrics> {
  const {
    impressions: _impressions,
    impressions_source: _impressionsSource,
    actual_impressions: _actualImpressions,
    forecast_impressions: _forecastImpressions,
    forecast_impressions_method: _forecastMethod,
    forecast_impressions_formula: _forecastFormula,
    ...providerMetrics
  } = metrics;
  return providerMetrics;
}

export function stripReachFromCollectedMetrics(
  metrics: Partial<CollectedMetrics> & MergedReachFields
): Partial<CollectedMetrics> {
  const {
    reach: _reach,
    reach_source: _reachSource,
    actual_reach: _actualReach,
    forecast_reach: _forecastReach,
    forecast_confidence: _forecastConfidence,
    forecast_method: _forecastMethod,
    ...providerMetrics
  } = metrics;
  return providerMetrics;
}

export function mergeCollectedMetrics(
  base: Partial<CollectedMetrics>,
  incoming: Partial<CollectedMetrics>,
  context?: MergeMetricsContext
): Partial<CollectedMetrics> &
  MergedReachFields &
  MergedImpressionsFields & { engagement_rate_method?: EngagementRateMethod } {
  const merged: Partial<CollectedMetrics> = {};
  for (const key of COLLECTED_METRIC_KEYS) {
    if (key === "reach" || key === "impressions") continue;
    merged[key] =
      sanitizeMetricValue(incoming[key]) ?? sanitizeMetricValue(base[key]);
  }

  const storedMethod = context?.engagement_rate_method;
  const manualRate =
    storedMethod === "manual" && base.engagement_rate != null
      ? base.engagement_rate
      : context?.manualEngagementRate ?? null;

  const isManualSource =
    context?.metrics_source === "manual" || context?.metrics_source === "manual_import";
  const incomingReach = sanitizeMetricValue(incoming.reach);
  const reachSnapshot = resolveReachSnapshot({
    providerReach: isManualSource ? null : incomingReach,
    manualReach: isManualSource ? incomingReach : null,
    storedReach: context?.stored_reach ?? sanitizeMetricValue(base.reach),
    storedReachSource: context?.reach_source ?? null,
    storedActualReach: context?.stored_actual_reach ?? null,
    storedForecastReach: context?.stored_forecast_reach ?? null,
    followers: context?.followers ?? null,
    platform: context?.platform,
    publication_type: context?.publication_type,
    isManualSource,
  });

  merged.reach = reachSnapshot.reach;

  const incomingImpressions = sanitizeMetricValue(incoming.impressions);
  const impressionsSnapshot = resolveImpressionsSnapshot({
    providerImpressions: isManualSource ? null : incomingImpressions,
    manualImpressions: isManualSource ? incomingImpressions : null,
    storedImpressions: context?.stored_impressions ?? sanitizeMetricValue(base.impressions),
    storedImpressionsSource: context?.impressions_source ?? null,
    storedActualImpressions: context?.stored_actual_impressions ?? null,
    storedForecastImpressions: context?.stored_forecast_impressions ?? null,
    platform: context?.platform,
    publication_type: context?.publication_type,
    views: merged.views ?? null,
    effectiveReach: merged.reach ?? null,
    isManualSource,
  });

  merged.impressions = impressionsSnapshot.impressions;

  const snapshot = computeEngagementSnapshot({
    views: merged.views ?? null,
    reach: merged.reach ?? null,
    likes: merged.likes ?? null,
    comments: merged.comments ?? null,
    shares: merged.shares ?? null,
    saves: merged.saves ?? null,
    followers: context?.followers ?? null,
    manualEngagementRate: manualRate,
  });

  merged.engagements = snapshot.engagements > 0 ? snapshot.engagements : null;
  merged.engagement_rate = snapshot.engagement_rate;

  return {
    ...merged,
    engagement_rate_method: snapshot.engagement_rate_method,
    reach_source: reachSnapshot.reach_source,
    actual_reach: reachSnapshot.actual_reach,
    forecast_reach: reachSnapshot.forecast_reach,
    forecast_confidence: reachSnapshot.forecast_confidence,
    forecast_method: reachSnapshot.forecast_method,
    impressions_source: impressionsSnapshot.impressions_source,
    actual_impressions: impressionsSnapshot.actual_impressions,
    forecast_impressions: impressionsSnapshot.forecast_impressions,
    forecast_impressions_method: impressionsSnapshot.forecast_method,
    forecast_impressions_formula: impressionsSnapshot.forecast_formula,
  };
}

export function hasAnyMetric(metrics: Partial<CollectedMetrics>): boolean {
  return [
    metrics.views,
    metrics.reach,
    metrics.impressions,
    metrics.likes,
    metrics.comments,
    metrics.shares,
    metrics.saves,
    metrics.plays,
    metrics.clicks,
  ].some((v) => sanitizeMetricValue(v) != null);
}

export function hasCoreMetrics(metrics: Partial<CollectedMetrics>): boolean {
  return (
    sanitizeMetricValue(metrics.views) != null ||
    sanitizeMetricValue(metrics.likes) != null ||
    sanitizeMetricValue(metrics.comments) != null
  );
}

/** Provider chain can stop once views, likes, or comments are populated. */
export function isCompleteMetrics(metrics: Partial<CollectedMetrics>): boolean {
  return hasCoreMetrics(metrics);
}

export function metricsRefreshStatusFor(
  metrics: Partial<CollectedMetrics>,
  context?: MetricsRefreshContext
): "completed" | "partial" {
  return metricsRefreshStatusForEngagement(
    {
      views: sanitizeMetricValue(metrics.views),
      reach: sanitizeMetricValue(metrics.reach),
      likes: sanitizeMetricValue(metrics.likes),
      comments: sanitizeMetricValue(metrics.comments),
      shares: sanitizeMetricValue(metrics.shares),
      saves: sanitizeMetricValue(metrics.saves),
    },
    context
  );
}
