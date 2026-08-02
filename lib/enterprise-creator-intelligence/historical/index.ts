export type {
  CreatorHistoricalAiHints,
  CreatorHistoricalMonthlySeries,
  CreatorMetricsCaptureInput,
  CreatorMonthlyMetrics,
} from "@/lib/enterprise-creator-intelligence/historical/types";

export {
  computeAverage,
  computeFollowerDifference,
  computeMedian,
  computeMonthlyGrowthRate,
  computePostingFrequencyPerWeek,
  deriveGrowthTrend,
} from "@/lib/enterprise-creator-intelligence/historical/compute";

export {
  previousPeriodMonth,
  toPeriodMonth,
} from "@/lib/enterprise-creator-intelligence/historical/period";

export {
  appendCreatorMetricsCapture,
  captureInputFromNormalizedProfile,
} from "@/lib/enterprise-creator-intelligence/historical/append-capture";

export { upsertMonthlyMetricsFromCapture } from "@/lib/enterprise-creator-intelligence/historical/rollup-monthly";

export {
  buildHistoricalAiHints,
  loadCreatorMonthlyMetrics,
} from "@/lib/enterprise-creator-intelligence/historical/load-monthly";

export {
  enrichHistoricalSeries,
  wrapHistoricalSeriesExplainability,
  type CreatorHistoricalExplainability,
} from "@/lib/enterprise-creator-intelligence/historical/explainability";
