import { formatMoneyDetail } from "@/lib/finance/currency-format";
import {
  emptyBenchmarkSupport,
  withCreatorBenchmark,
} from "@/lib/enterprise-creator-intelligence/commercial/benchmarks";
import { buildComparisonWindows } from "@/lib/enterprise-creator-intelligence/commercial/comparisons";
import { buildCommercialContext } from "@/lib/enterprise-creator-intelligence/commercial/context";
import { resolveCommercialMetricSource } from "@/lib/enterprise-creator-intelligence/commercial/sources";
import {
  classifyBusinessTrend,
  deriveTrendDirection,
} from "@/lib/enterprise-creator-intelligence/commercial/trend";
import type {
  CommercialConfidence,
  CommercialMetric,
  CommercialMetricKey,
  CommercialMetricPoint,
  CommercialMetricUnit,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

export { deriveTrendDirection } from "@/lib/enterprise-creator-intelligence/commercial/trend";

/** Required top-level keys on every commercial metric (dashboard contract). */
export const STANDARD_METRIC_FIELDS = [
  "currentValue",
  "previousValue",
  "trend",
  "trendDirection",
  "trendLabel",
  "confidence",
  "confidenceReason",
  "formula",
  "inputs",
  "missingInputs",
  "source",
  "lastUpdated",
  "historicalSeriesAvailable",
  "comparisons",
  "benchmarks",
  "meaning",
  "reason",
  "businessContext",
  "explainability",
] as const;

export function buildCommercialMetric(input: {
  key: CommercialMetricKey;
  label: string;
  currentValue: number | null;
  previousValue?: number | null;
  historicalTrend?: CommercialMetricPoint[];
  lastUpdated: string | null;
  currencyCode?: string | null;
  unit: CommercialMetricUnit;
  confidence: CommercialConfidence;
  sourceLabelOverride?: string;
  formulaUsed: string;
  formulaId: string;
  inputData: Record<string, number | string | null>;
  missingInputs: string[];
  creatorAverage?: number | null;
}): CommercialMetric {
  const previousValue = input.previousValue ?? null;
  const trend = input.historicalTrend ?? [];
  const trendDirection = deriveTrendDirection(input.currentValue, previousValue);
  const trendLabel = classifyBusinessTrend(input.key, trendDirection);
  const historicalSeriesAvailable = trend.length > 0 ? "Yes" : "No";

  const source = resolveCommercialMetricSource({
    key: input.key,
    labelOverride: input.sourceLabelOverride,
    lastRefresh: input.lastUpdated,
    confidence: input.confidence.percent,
  });

  const creatorAverage =
    input.creatorAverage ??
    (trend.length > 0
      ? averageSeries(trend)
      : previousValue);

  const benchmarks = withCreatorBenchmark(
    emptyBenchmarkSupport(),
    creatorAverage
  );

  const comparisons = buildComparisonWindows({
    currentValue: input.currentValue,
    series: trend,
    asOf: input.lastUpdated ?? undefined,
  });

  const context = buildCommercialContext({
    key: input.key,
    label: input.label,
    currentValue: input.currentValue,
    previousValue,
    creatorAverage,
    trendLabel,
    missingInputs: input.missingInputs,
  });

  const currentDisplay =
    input.unit === "money" &&
    input.currentValue != null &&
    input.currencyCode
      ? formatMoneyDetail(input.currentValue, input.currencyCode)
      : null;

  const confidenceReason = input.confidence.reason;

  return {
    key: input.key,
    label: input.label,
    currentValue: input.currentValue,
    previousValue,
    trend,
    historicalTrend: trend,
    trendDirection,
    trendLabel,
    confidence: input.confidence,
    confidenceReason,
    formula: input.formulaUsed,
    formulaId: input.formulaId,
    inputs: input.inputData,
    missingInputs: input.missingInputs,
    source,
    lastUpdated: input.lastUpdated,
    historicalSeriesAvailable,
    comparisons,
    benchmarks,
    meaning: context.meaning,
    reason: context.reason,
    businessContext: context.businessContext,
    explainability: {
      value: input.currentValue,
      meaning: context.meaning,
      formula: input.formulaUsed,
      formulaId: input.formulaId,
      reason: context.reason,
      confidence: input.confidence.percent,
      trend: trendLabel,
      businessContext: context.businessContext,
      source,
      inputs: input.inputData,
      missingInputs: input.missingInputs,
      lastUpdated: input.lastUpdated,
    },
    currencyCode: input.currencyCode ?? null,
    unit: input.unit,
    currentDisplay,
  };
}

function averageSeries(series: CommercialMetricPoint[]): number | null {
  const values = series
    .map((p) => p.value)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (values.length === 0) return null;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

export function assertStandardMetricShape(metric: CommercialMetric): string[] {
  const missing: string[] = [];
  for (const field of STANDARD_METRIC_FIELDS) {
    if ((metric as Record<string, unknown>)[field] === undefined) {
      missing.push(field);
    }
  }
  if (!metric.source.system) missing.push("source.system");
  if (!metric.source.collectionMethod) missing.push("source.collectionMethod");
  if (!("lastRefresh" in metric.source)) missing.push("source.lastRefresh");
  if (!("confidence" in metric.source)) missing.push("source.confidence");
  return missing;
}
