import type {
  AnalyticsAgingRow,
  AnalyticsCategoryPoint,
  AnalyticsChartBundle,
  AnalyticsKpiStrip,
  AnalyticsRankingRow,
  AnalyticsTimeSeriesPoint,
} from "@/lib/analytics/types/outputs";
import type { FinancialMetrics } from "@/lib/analytics/types/metrics";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";

/** Normalized payload for KPI card grids (executive dashboard Sprint 1B). */
export type DashboardKpiOutput = {
  strip: AnalyticsKpiStrip;
};

/** Line / bar chart series from rollup nodes. */
export function rollupNodesToBarSeries(
  nodes: AnalyticsRollupNode[],
  metric: keyof Pick<FinancialMetrics, "revenue" | "gp" | "invoiced_revenue" | "collected_revenue">
): AnalyticsCategoryPoint[] {
  return nodes.map((node) => ({
    key: node.key,
    label: node.label,
    value: node.metrics[metric],
    metrics: node.metrics,
  }));
}

/** Pie chart slice from category points (top N by value). */
export function categoryPointsToPieSeries(
  points: AnalyticsCategoryPoint[],
  limit = 8
): AnalyticsCategoryPoint[] {
  return [...points]
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function buildDashboardChartBundle(input: {
  time_series?: AnalyticsTimeSeriesPoint[];
  bar_series?: AnalyticsCategoryPoint[];
  pie_series?: AnalyticsCategoryPoint[];
  ranking_table?: AnalyticsRankingRow[];
  aging_table?: AnalyticsAgingRow[];
}): AnalyticsChartBundle {
  return {
    time_series: input.time_series ?? [],
    bar_series: input.bar_series ?? [],
    pie_series: input.pie_series ?? [],
    ranking_table: input.ranking_table ?? [],
    aging_table: input.aging_table ?? [],
  };
}
