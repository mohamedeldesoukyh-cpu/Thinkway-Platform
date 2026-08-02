/**
 * Enterprise Creator Intelligence — Commercial (Sprint 2)
 * Product-hardened dashboard model: one standard metric object for all consumers.
 */

export type CommercialMetricKey =
  | "cpm"
  | "cpe"
  | "emv"
  | "roi"
  | "average_views"
  | "median_views"
  | "average_reach"
  | "estimated_reach"
  | "cost_per_deliverable"
  | "historical_pricing"
  | "negotiation_trend"
  | "price_movement";

export type CommercialMetricUnit =
  | "money"
  | "ratio"
  | "count"
  | "percent"
  | "index";

/** Numeric direction for charts / math. */
export type CommercialTrendDirection = "up" | "down" | "flat" | "unknown";

/**
 * Business trend label — consistent vocabulary for Planning / Client / Reporting / AI.
 * Cost-efficiency metrics use Improving/Declining; price series use Increasing/Decreasing.
 */
export type CommercialTrendLabel =
  | "Improving"
  | "Declining"
  | "Stable"
  | "Increasing"
  | "Decreasing"
  | "Unknown";

export type CommercialTrendPolarity =
  | "higher_is_better"
  | "lower_is_better"
  | "price_direction";

export type YesNo = "Yes" | "No";

/** Source verification for debugging, AI, reporting, client transparency. */
export type CommercialMetricSource = {
  id: string;
  label: string;
  system: string;
  collectionMethod: string;
  lastRefresh: string | null;
  confidence: number | null;
};

export type CommercialConfidence = {
  /** 0–100 inclusive when computable. */
  percent: number | null;
  /** Human-readable confidence reason for dashboards. */
  reason: string;
  basedOn: Array<{ label: string; value: string | number }>;
};

/** Comparison windows — data model only (no UI). */
export type CommercialComparisonWindows = {
  current: number | null;
  previousMonth: number | null;
  previousQuarter: number | null;
  previousSixMonths: number | null;
  previousYear: number | null;
  lifetime: number | null;
};

/**
 * Benchmark extension points — not calculated in Sprint 2.
 * Future Category / Market intelligence fills these without redesign.
 */
export type CommercialBenchmarkSlot = {
  value: number | null;
  available: boolean;
  note: string;
};

export type CommercialBenchmarkSupport = {
  creator: CommercialBenchmarkSlot;
  campaign: CommercialBenchmarkSlot;
  category: CommercialBenchmarkSlot;
  platform: CommercialBenchmarkSlot;
  /** Future — do not calculate in Sprint 2. */
  market: CommercialBenchmarkSlot;
};

export type CommercialMetricPoint = {
  at: string;
  value: number | null;
};

/**
 * Full explainability package — no metric may return only a number.
 * Mirrors top-level fields for AI / Reporting consumers that prefer a nested bundle.
 */
export type CommercialExplainability = {
  value: number | null;
  meaning: string;
  formula: string;
  formulaId: string;
  reason: string;
  confidence: number | null;
  trend: CommercialTrendLabel;
  businessContext: string;
  source: CommercialMetricSource;
  inputs: Record<string, number | string | null>;
  missingInputs: string[];
  lastUpdated: string | null;
};

/**
 * Standard Commercial Intelligence Dashboard metric object.
 * Every commercial metric uses this exact structure — no divergent metadata.
 */
export type CommercialMetric = {
  key: CommercialMetricKey;
  label: string;
  /** Current Value */
  currentValue: number | null;
  /** Previous Value */
  previousValue: number | null;
  /** Trend series (points) */
  trend: CommercialMetricPoint[];
  /** @deprecated alias of `trend` — retained for Sprint 2 early consumers */
  historicalTrend: CommercialMetricPoint[];
  trendDirection: CommercialTrendDirection;
  /** Business trend label */
  trendLabel: CommercialTrendLabel;
  confidence: CommercialConfidence;
  /** Confidence Reason (also on confidence.reason) */
  confidenceReason: string;
  formula: string;
  formulaId: string;
  inputs: Record<string, number | string | null>;
  missingInputs: string[];
  source: CommercialMetricSource;
  lastUpdated: string | null;
  historicalSeriesAvailable: YesNo;
  comparisons: CommercialComparisonWindows;
  benchmarks: CommercialBenchmarkSupport;
  /** Why this number matters */
  meaning: string;
  reason: string;
  businessContext: string;
  explainability: CommercialExplainability;
  currencyCode: string | null;
  unit: CommercialMetricUnit;
  /** Financial Display Standard (ISO codes, never symbols). */
  currentDisplay: string | null;
};

export type CommercialHealthLevel =
  | "Excellent"
  | "Good"
  | "Monitor"
  | "Attention"
  | "Critical";

/** Summary for Planning / Client — not an investment score. */
export type CommercialHealth = {
  level: CommercialHealthLevel;
  summary: string;
  dimensions: {
    pricing: CommercialHealthLevel;
    efficiency: CommercialHealthLevel;
    performance: CommercialHealthLevel;
    commercialStability: CommercialHealthLevel;
    commercialConfidence: CommercialHealthLevel;
  };
  reasons: string[];
};

export type InvestmentReadinessStatus =
  | "Commercial Ready"
  | "Needs More Data"
  | "Limited Confidence"
  | "Historical Only"
  | "Insufficient Campaign History";

/** Planning readiness — not the Creator Investment Score. */
export type InvestmentReadiness = {
  status: InvestmentReadinessStatus;
  summary: string;
  blockers: string[];
  campaignCount: number;
  metricCoverage: number;
  averageConfidence: number | null;
};

export type CreatorCommercialIntelligence = {
  influencerId: string;
  platform: string | null;
  currencyCode: string | null;
  computedAt: string;
  metrics: CommercialMetric[];
  commercialHealth: CommercialHealth;
  investmentReadiness: InvestmentReadiness;
  /** AI-ready — no AI execution. */
  aiHints: CreatorCommercialAiHints;
  /** Declared platform consumers (reuse contract). */
  consumers: readonly string[];
};

export type CreatorCommercialAiHints = {
  metricsAvailable: boolean;
  metricCount: number;
  moneyMetricsReady: boolean;
  lowConfidenceKeys: CommercialMetricKey[];
  recommendCommercialRefresh: boolean;
  commercialHealth: CommercialHealthLevel;
  investmentReadiness: InvestmentReadinessStatus;
};

export type CommercialHistoryCapture = {
  id: string;
  influencerId: string;
  platform: string | null;
  capturedAt: string;
  currencyCode: string | null;
  metrics: CommercialMetric[];
};

export const COMMERCIAL_INTELLIGENCE_CONSUMERS = [
  "Planning Workspace",
  "Client Workspace",
  "Campaign Workspace",
  "Reporting Hub",
  "Enterprise Analytics",
  "AI Copilot",
  "Mobile",
] as const;
