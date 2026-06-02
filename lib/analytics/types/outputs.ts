import type { AnalyticsCurrencyContext } from "@/lib/analytics/types/metrics";
import type { FinancialMetrics } from "@/lib/analytics/types/metrics";

/** KPI card payload for executive / finance dashboards. */
export type AnalyticsKpiCard = {
  id: string;
  label: string;
  value: number;
  formatted_value: string;
  currency: AnalyticsCurrencyContext;
  trend_delta?: number | null;
  trend_percent?: number | null;
  alert?: "default" | "warning" | "danger" | "success";
};

export type AnalyticsKpiStrip = {
  cards: AnalyticsKpiCard[];
  currency: AnalyticsCurrencyContext;
  generated_at: string;
};

export type AnalyticsTimeSeriesPoint = {
  period: string;
  label: string;
  metrics: Pick<
    FinancialMetrics,
    "revenue" | "invoiced_revenue" | "collected_revenue" | "gp"
  >;
};

export type AnalyticsCategoryPoint = {
  key: string;
  label: string;
  value: number;
  metrics?: Partial<FinancialMetrics>;
};

export type AnalyticsRankingRow = {
  rank: number;
  key: string;
  label: string;
  currency_code: string;
  metrics: FinancialMetrics;
};

export type AnalyticsAgingRow = {
  bucket: string;
  label: string;
  count: number;
  amount: number;
};

export type AnalyticsChartBundle = {
  time_series: AnalyticsTimeSeriesPoint[];
  bar_series: AnalyticsCategoryPoint[];
  pie_series: AnalyticsCategoryPoint[];
  ranking_table: AnalyticsRankingRow[];
  aging_table: AnalyticsAgingRow[];
};

export type ExecutiveAnalyticsOutput = {
  kpis: AnalyticsKpiStrip;
  rollups: import("@/lib/analytics/types/metrics").AnalyticsRollupNode[];
  charts: AnalyticsChartBundle;
  facts_count: number;
};

export type RevenueAnalyticsOutput = {
  kpis: AnalyticsKpiStrip;
  by_client: AnalyticsCategoryPoint[];
  by_brand: AnalyticsCategoryPoint[];
  time_series: AnalyticsTimeSeriesPoint[];
  ranking: AnalyticsRankingRow[];
};

export type ProfitabilityAnalyticsOutput = {
  kpis: AnalyticsKpiStrip;
  margin_by_client: AnalyticsCategoryPoint[];
  gp_ranking: AnalyticsRankingRow[];
  time_series: AnalyticsTimeSeriesPoint[];
};

export type CollectionsAnalyticsOutput = {
  kpis: AnalyticsKpiStrip;
  aging: AnalyticsAgingRow[];
  outstanding_by_client: AnalyticsCategoryPoint[];
  collection_time_series: AnalyticsTimeSeriesPoint[];
};

export type OperationalAnalyticsOutput = {
  kpis: AnalyticsKpiStrip;
  achieved_vs_unachieved: AnalyticsCategoryPoint[];
  invoiced_vs_remaining: AnalyticsCategoryPoint[];
  by_campaign: AnalyticsRankingRow[];
};
