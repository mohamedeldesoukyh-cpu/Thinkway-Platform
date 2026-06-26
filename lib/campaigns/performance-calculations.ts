import {
  computeEngagements as engineComputeEngagements,
  computeEngagementRate as engineComputeEngagementRate,
  type EngagementRateInput,
} from "@/lib/performance/engagement-rate-engine";

export type PerformanceMetricInput = {
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  cost: number | null;
  followers?: number | null;
  manualEngagementRate?: number | null;
};

function toEngagementInput(metrics: PerformanceMetricInput): EngagementRateInput {
  return {
    views: metrics.views,
    reach: metrics.reach,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    saves: metrics.saves,
    followers: metrics.followers ?? null,
    manualEngagementRate: metrics.manualEngagementRate ?? null,
  };
}

/** @deprecated Use computeEngagements from engagement-rate-engine directly. */
export function totalEngagements(metrics: PerformanceMetricInput): number {
  return engineComputeEngagements(toEngagementInput(metrics));
}

/** @deprecated Use computeEngagementRate from engagement-rate-engine directly. */
export function calculateEngagementRate(metrics: PerformanceMetricInput): number | null {
  return engineComputeEngagementRate(toEngagementInput(metrics)).engagement_rate;
}

export function calculateViewRate(metrics: PerformanceMetricInput): number | null {
  const impressions = metrics.impressions;
  const views = metrics.views;
  if (!impressions || impressions <= 0 || views == null) return null;
  return (views / impressions) * 100;
}

export function calculateCpm(cost: number | null, impressions: number | null): number | null {
  if (!cost || cost <= 0 || !impressions || impressions <= 0) return null;
  return (cost / impressions) * 1000;
}

export function calculateCpv(cost: number | null, views: number | null): number | null {
  if (!cost || cost <= 0 || !views || views <= 0) return null;
  return cost / views;
}

export function calculateCpe(
  cost: number | null,
  metrics: PerformanceMetricInput
): number | null {
  const engagements = totalEngagements(metrics);
  if (!cost || cost <= 0 || engagements <= 0) return null;
  return cost / engagements;
}

export function calculateCpc(cost: number | null, clicks: number | null): number | null {
  if (!cost || cost <= 0 || !clicks || clicks <= 0) return null;
  return cost / clicks;
}

export function deriveCalculatedMetrics(
  input: PerformanceMetricInput
): Pick<
  PerformanceMetricInput,
  never
> & {
  engagement_rate: number | null;
  view_rate: number | null;
  cpm: number | null;
  cpv: number | null;
  cpe: number | null;
  cpc: number | null;
} {
  return {
    engagement_rate: engineComputeEngagementRate(toEngagementInput(input)).engagement_rate,
    view_rate: calculateViewRate(input),
    cpm: calculateCpm(input.cost, input.impressions),
    cpv: calculateCpv(input.cost, input.views),
    cpe: calculateCpe(input.cost, input),
    cpc: calculateCpc(input.cost, input.clicks),
  };
}

export function formatCompactCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

export function formatPercent(value: number | null | undefined, digits = 2): string {
  if (value == null) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatMoneyValue(
  value: number | null | undefined,
  currency = "USD"
): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
