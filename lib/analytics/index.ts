export type {
  AnalyticsQueryFilters,
  AnalyticsRollupLevel,
  AnalyticsDateRange,
  AnalyticsBillingFilter,
  AnalyticsOperationalFilter,
  AnalyticsInvoiceFilter,
  DEFAULT_ANALYTICS_FILTERS,
} from "@/lib/analytics/types/filters";

export type {
  FinancialMetrics,
  CampaignAnalyticsFact,
  AnalyticsRollupNode,
  AnalyticsCurrencyContext,
  PlanningBudgetSlice,
} from "@/lib/analytics/types/metrics";

export type {
  AnalyticsKpiCard,
  AnalyticsKpiStrip,
  AnalyticsTimeSeriesPoint,
  AnalyticsCategoryPoint,
  AnalyticsRankingRow,
  AnalyticsAgingRow,
  AnalyticsChartBundle,
  ExecutiveAnalyticsOutput,
  RevenueAnalyticsOutput,
  ProfitabilityAnalyticsOutput,
  CollectionsAnalyticsOutput,
  OperationalAnalyticsOutput,
} from "@/lib/analytics/types/outputs";

export {
  METRIC_DEFINITIONS,
  ACHIEVED_LINE_STATUSES,
  INVOICED_LINE_STATUSES,
} from "@/lib/analytics/metrics/definitions";

export {
  emptyFinancialMetrics,
  mergeFinancialMetrics,
  metricsFromCampaignLines,
  applyInvoiceCollectionMetrics,
  computeMarginPercent,
  lineAchievedRevenue,
  linePlannedRevenue,
} from "@/lib/analytics/metrics/financial";

export { roundMoney } from "@/lib/analytics/aggregations/round";
export {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
  invalidateAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
export {
  rollupFacts,
  rollupGlobal,
} from "@/lib/analytics/aggregations/rollup-engine";

export {
  buildCurrencyContext,
  formatAnalyticsAmount,
  convertAnalyticsAmount,
  currencySymbol,
  formatCurrencyAmount,
  CURRENCY_SYMBOLS,
} from "@/lib/analytics/currency/engine";

export { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
export type { AnalyticsFactsSnapshot } from "@/lib/analytics/queries/load-facts";
export { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
export { mapFinancialMetricsToBillingKpis } from "@/lib/analytics/queries/billing-bridge";
export type { BillingKpiExtras } from "@/lib/analytics/queries/billing-bridge";

export { getExecutiveKpis } from "@/lib/analytics/queries/executive";
export { getRevenueAnalytics } from "@/lib/analytics/queries/revenue";
export { getProfitabilityAnalytics } from "@/lib/analytics/queries/profitability";
export { getCollectionsAnalytics } from "@/lib/analytics/queries/collections";
export { getOperationalAnalytics } from "@/lib/analytics/queries/operational";

export {
  buildExecutiveDashboardCharts,
  type ExecutiveDashboardCharts,
  type DashboardTrendPoint,
} from "@/lib/analytics/queries/dashboard-charts";
export {
  buildFinanceAlerts,
  type FinanceAlert,
  type FinanceAlertsPayload,
} from "@/lib/analytics/queries/dashboard-alerts";
export {
  parseDashboardSearchParams,
  dashboardFiltersToAnalytics,
  serializeDashboardFilters,
  type DashboardFilterState,
} from "@/lib/analytics/dashboard-filters";

export {
  emptyPlanningBudgetSlice,
  planningSliceFromBudgetFields,
  enrichMetricsWithPlanning,
  varianceToPlanningKpis,
  type PlanningVarianceKpi,
} from "@/lib/analytics/planning/budget-integration";
export {
  loadPlanningAnalyticsSnapshot,
  type PlanningAnalyticsSnapshot,
} from "@/lib/analytics/planning/snapshot";

export {
  buildDashboardChartBundle,
  categoryPointsToPieSeries,
  rollupNodesToBarSeries,
} from "@/lib/analytics/queries/dashboard-outputs";
export type { DashboardKpiOutput } from "@/lib/analytics/queries/dashboard-outputs";
