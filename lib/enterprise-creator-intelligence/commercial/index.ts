export type {
  CommercialBenchmarkSlot,
  CommercialBenchmarkSupport,
  CommercialComparisonWindows,
  CommercialConfidence,
  CommercialExplainability,
  CommercialHealth,
  CommercialHealthLevel,
  CommercialHistoryCapture,
  CommercialMetric,
  CommercialMetricKey,
  CommercialMetricPoint,
  CommercialMetricSource,
  CommercialMetricUnit,
  CommercialTrendDirection,
  CommercialTrendLabel,
  CommercialTrendPolarity,
  CreatorCommercialAiHints,
  CreatorCommercialIntelligence,
  InvestmentReadiness,
  InvestmentReadinessStatus,
  YesNo,
} from "@/lib/enterprise-creator-intelligence/commercial/types";

export { COMMERCIAL_INTELLIGENCE_CONSUMERS } from "@/lib/enterprise-creator-intelligence/commercial/types";

export {
  COMMERCIAL_METRIC_SOURCES,
  COMMERCIAL_METRIC_SOURCE_TEMPLATES,
  platformHistoricalSourceLabel,
  resolveCommercialMetricSource,
} from "@/lib/enterprise-creator-intelligence/commercial/sources";

export {
  FORMULA_IDS,
  FORMULA_TEXT,
  computeCommercialCpm,
  computeCommercialCpe,
  computeCommercialEmv,
  computeCommercialRoi,
  computeCostPerDeliverable,
  computeImpliedBenchmarkCpm,
  computePriceMovementRatio,
  negotiationTrendFromSeries,
} from "@/lib/enterprise-creator-intelligence/commercial/formulas";

export {
  buildConfidenceReason,
  computeCommercialConfidence,
} from "@/lib/enterprise-creator-intelligence/commercial/confidence";

export {
  STANDARD_METRIC_FIELDS,
  assertStandardMetricShape,
  buildCommercialMetric,
  deriveTrendDirection,
} from "@/lib/enterprise-creator-intelligence/commercial/build-metric";

export {
  classifyBusinessTrend,
  metricTrendPolarity,
} from "@/lib/enterprise-creator-intelligence/commercial/trend";

export { buildComparisonWindows } from "@/lib/enterprise-creator-intelligence/commercial/comparisons";

export {
  emptyBenchmarkSupport,
  withCreatorBenchmark,
} from "@/lib/enterprise-creator-intelligence/commercial/benchmarks";

export { computeCommercialHealth } from "@/lib/enterprise-creator-intelligence/commercial/health";

export { computeInvestmentReadiness } from "@/lib/enterprise-creator-intelligence/commercial/readiness";

export {
  computeCreatorCommercialIntelligence,
  type CreatorCommercialFacts,
} from "@/lib/enterprise-creator-intelligence/commercial/compute";

export { loadCreatorCommercialFacts } from "@/lib/enterprise-creator-intelligence/commercial/load-facts";

export { appendCommercialIntelligenceCapture } from "@/lib/enterprise-creator-intelligence/commercial/persist";

export {
  buildCommercialAiHints,
  loadCreatorCommercialIntelligence,
} from "@/lib/enterprise-creator-intelligence/commercial/load-commercial";
