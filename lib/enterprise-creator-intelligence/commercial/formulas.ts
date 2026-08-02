/**
 * Commercial formulas — reuse platform CPM/CPE calculators; define EMV/ROI here once.
 */

import {
  calculateCpe,
  calculateCpm,
  type PerformanceMetricInput,
} from "@/lib/campaigns/performance-calculations";
import { computeAverage, computeMedian } from "@/lib/enterprise-creator-intelligence/historical/compute";

export const FORMULA_IDS = {
  cpm: "thinkway_cpm_v1",
  cpe: "thinkway_cpe_v1",
  emv: "thinkway_emv_v1",
  roi: "thinkway_roi_v1",
  average_views: "thinkway_avg_views_v1",
  median_views: "thinkway_median_views_v1",
  average_reach: "thinkway_avg_reach_v1",
  estimated_reach: "thinkway_estimated_reach_v1",
  cost_per_deliverable: "thinkway_cost_per_deliverable_v1",
  historical_pricing: "thinkway_historical_pricing_v1",
  negotiation_trend: "thinkway_negotiation_trend_v1",
  price_movement: "thinkway_price_movement_v1",
} as const;

export const FORMULA_TEXT = {
  cpm: "CPM = (cost / impressions) × 1000",
  cpe: "CPE = cost / engagements",
  emv: "EMV = (impressions / 1000) × benchmark_cpm",
  roi: "ROI = (revenue − cost) / cost",
  average_views: "Average Views = mean(views sample)",
  median_views: "Median Views = median(views sample)",
  average_reach: "Average Reach = mean(actual reach sample)",
  estimated_reach: "Estimated Reach = mean(forecast/estimated reach sample)",
  cost_per_deliverable: "Cost Per Deliverable = total_cost / deliverable_count",
  historical_pricing: "Historical Pricing = mean(quoted costs)",
  negotiation_trend: "Negotiation Trend = direction of quoted price series",
  price_movement: "Price Movement = (latest_quote − prior_quote) / prior_quote",
} as const;

/** Reuses platform `calculateCpm`. */
export function computeCommercialCpm(
  cost: number | null,
  impressions: number | null
): number | null {
  return calculateCpm(cost, impressions);
}

/** Reuses platform `calculateCpe`. */
export function computeCommercialCpe(
  cost: number | null,
  metrics: PerformanceMetricInput
): number | null {
  return calculateCpe(cost, metrics);
}

/**
 * Thinkway Commercial Formula v1.
 * benchmark_cpm is preferred from Thinkway quoted-implied CPM
 * (avg_quoted_cost / avg_views) × 1000 when available.
 */
export function computeCommercialEmv(
  impressions: number | null,
  benchmarkCpm: number | null
): number | null {
  if (
    impressions == null ||
    impressions <= 0 ||
    benchmarkCpm == null ||
    benchmarkCpm <= 0
  ) {
    return null;
  }
  return Number(((impressions / 1000) * benchmarkCpm).toFixed(4));
}

/** Financial ROI from Thinkway campaign results. */
export function computeCommercialRoi(
  revenue: number | null,
  cost: number | null
): number | null {
  if (revenue == null || cost == null || cost <= 0) return null;
  return Number(((revenue - cost) / cost).toFixed(6));
}

export function computeCostPerDeliverable(
  totalCost: number | null,
  deliverableCount: number | null
): number | null {
  if (
    totalCost == null ||
    totalCost < 0 ||
    deliverableCount == null ||
    deliverableCount <= 0
  ) {
    return null;
  }
  return Number((totalCost / deliverableCount).toFixed(4));
}

export function computeImpliedBenchmarkCpm(
  avgQuotedCost: number | null,
  avgViews: number | null
): number | null {
  if (
    avgQuotedCost == null ||
    avgQuotedCost <= 0 ||
    avgViews == null ||
    avgViews <= 0
  ) {
    return null;
  }
  return Number(((avgQuotedCost / avgViews) * 1000).toFixed(4));
}

export function computePriceMovementRatio(
  latest: number | null,
  prior: number | null
): number | null {
  if (latest == null || prior == null || prior <= 0) return null;
  return Number(((latest - prior) / prior).toFixed(6));
}

export function negotiationTrendFromSeries(
  values: Array<number | null | undefined>
): number | null {
  const nums = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  if (nums.length < 2) return null;
  // Index: positive = prices rising, negative = falling (avg sequential delta / mean).
  let deltaSum = 0;
  for (let i = 1; i < nums.length; i++) {
    deltaSum += (nums[i]! - nums[i - 1]!) / nums[i - 1]!;
  }
  return Number((deltaSum / (nums.length - 1)).toFixed(6));
}

export function averageOf(values: Array<number | null | undefined>): number | null {
  return computeAverage(values);
}

export function medianOf(values: Array<number | null | undefined>): number | null {
  return computeMedian(values);
}
