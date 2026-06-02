import type { SupabaseClient } from "@supabase/supabase-js";

import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { devLog } from "@/lib/platform/logger";
import { loadApprovedBudgetVersion } from "@/lib/planning/queries/load-budget-versions";
import { loadBudgetVariance } from "@/lib/planning/queries/load-budget-variance";
import { loadBudgetLines } from "@/lib/planning/queries/load-budget-lines";
import { loadBudgetPeriods } from "@/lib/planning/queries/load-budget-periods";
import { loadForecastRollups, loadForecastVersions } from "@/lib/planning/queries/load-forecast-rollups";
import {
  buildBudgetMetricTrend,
  buildVarianceTrendFromPeriods,
  sortVariancesByMetric,
} from "@/lib/planning/queries/variance-series";
import type { BudgetRollupNode } from "@/lib/planning/budgets/budget-rollups";
import { loadBudgetRollups } from "@/lib/planning/queries/load-budget-rollups";
import type { VarianceAnalysis } from "@/lib/planning/types/variance";
import type { PlanningTrendPoint } from "@/lib/planning/queries/variance-series";

export type PlanningKpiCard = {
  id: string;
  label: string;
  value: number;
  formatted: string;
  variant?: "default" | "positive" | "negative";
  isPercent?: boolean;
};

export type PlanningDashboardCharts = {
  variance_trend: PlanningTrendPoint[];
  gp_variance_trend: PlanningTrendPoint[];
  collections_variance_trend: PlanningTrendPoint[];
  budget_trend: PlanningTrendPoint[];
  forecast_trend: PlanningTrendPoint[];
  margin_trend: PlanningTrendPoint[];
};

export type PlanningDashboardPayload = {
  kpis: PlanningKpiCard[];
  charts: PlanningDashboardCharts;
  global_variance: VarianceAnalysis | null;
  top_positive: VarianceAnalysis[];
  top_negative: VarianceAnalysis[];
  client_variance: VarianceAnalysis[];
  brand_variance: VarianceAnalysis[];
  country_variance: VarianceAnalysis[];
  drilldown_rollups: BudgetRollupNode[];
  forecast_global: BudgetRollupNode | null;
  currency: ReturnType<typeof buildCurrencyContext>;
};

export async function loadPlanningDashboard(
  supabase: SupabaseClient,
  input: {
    budgetVersionId: string | null;
    forecastVersionId: string | null;
    fiscalYear: number;
    analyticsFilters?: AnalyticsQueryFilters;
  }
): Promise<PlanningDashboardPayload> {
  const emptyCurrency = buildCurrencyContext([]);
  const empty: PlanningDashboardPayload = {
    kpis: [],
    charts: {
      variance_trend: [],
      gp_variance_trend: [],
      collections_variance_trend: [],
      budget_trend: [],
      forecast_trend: [],
      margin_trend: [],
    },
    global_variance: null,
    top_positive: [],
    top_negative: [],
    client_variance: [],
    brand_variance: [],
    country_variance: [],
    drilldown_rollups: [],
    forecast_global: null,
    currency: emptyCurrency,
  };

  const versionId =
    input.budgetVersionId ??
    (await loadApprovedBudgetVersion(supabase, input.fiscalYear))?.id ??
    null;

  if (!versionId) {
    return empty;
  }

  const [varianceResult, periods, lines, clientVar, brandVar, countryVar, drilldown] =
    await Promise.all([
      loadBudgetVariance(supabase, versionId, "global", input.analyticsFilters ?? {}),
      loadBudgetPeriods(supabase, versionId),
      loadBudgetLines(supabase, versionId),
      loadBudgetVariance(supabase, versionId, "client", input.analyticsFilters ?? {}),
      loadBudgetVariance(supabase, versionId, "brand", input.analyticsFilters ?? {}),
      loadBudgetVariance(supabase, versionId, "country", input.analyticsFilters ?? {}),
      loadBudgetRollups(supabase, versionId, "client", input.analyticsFilters ?? {}),
    ]);

  const global = varianceResult.global;
  const currency = global.currency;

  let forecast_global: BudgetRollupNode | null = null;
  if (input.forecastVersionId) {
    const forecastRollups = await loadForecastRollups(
      supabase,
      input.forecastVersionId,
      "global"
    );
    forecast_global = forecastRollups.global;
  } else {
    const forecasts = await loadForecastVersions(supabase, {
      fiscalYear: input.fiscalYear,
      limit: 1,
    });
    if (forecasts[0]) {
      const forecastRollups = await loadForecastRollups(supabase, forecasts[0].id, "global");
      forecast_global = forecastRollups.global;
    }
  }

  const format = (n: number, decimals = 0) =>
    formatAnalyticsAmount(n, currency, { decimals });

  const kpis: PlanningKpiCard[] = [
    {
      id: "budget_revenue",
      label: "Budget revenue",
      value: global.budget.revenue_budget,
      formatted: format(global.budget.revenue_budget),
    },
    {
      id: "actual_revenue",
      label: "Actual revenue",
      value: global.actual.revenue,
      formatted: format(global.actual.revenue),
    },
    {
      id: "variance",
      label: "Variance",
      value: global.variance_amount.revenue,
      formatted: format(global.variance_amount.revenue),
      variant: global.variance_amount.revenue >= 0 ? "positive" : "negative",
    },
    {
      id: "variance_pct",
      label: "Variance %",
      value: global.variance_percent.revenue,
      formatted: `${global.variance_percent.revenue.toFixed(1)}%`,
      isPercent: true,
      variant: global.variance_percent.revenue >= 0 ? "positive" : "negative",
    },
    {
      id: "forecast_revenue",
      label: "Forecast revenue",
      value: forecast_global?.metrics.revenue_budget ?? 0,
      formatted: format(forecast_global?.metrics.revenue_budget ?? 0),
    },
    {
      id: "forecast_gp",
      label: "Forecast GP",
      value: forecast_global?.metrics.gp_budget ?? 0,
      formatted: format(forecast_global?.metrics.gp_budget ?? 0),
    },
    {
      id: "planned_margin",
      label: "Planned margin %",
      value: global.budget.margin_budget,
      formatted: `${global.budget.margin_budget.toFixed(1)}%`,
      isPercent: true,
    },
    {
      id: "collections_forecast",
      label: "Collections forecast",
      value: forecast_global?.metrics.collections_budget ?? global.budget.collections_budget,
      formatted: format(
        forecast_global?.metrics.collections_budget ?? global.budget.collections_budget
      ),
    },
    {
      id: "vendor_budget",
      label: "Vendor cost budget",
      value: global.budget.vendor_cost_budget,
      formatted: format(global.budget.vendor_cost_budget),
    },
  ];

  const charts: PlanningDashboardCharts = {
    variance_trend: buildVarianceTrendFromPeriods(
      periods,
      lines,
      (v) => v.variance_amount.revenue,
      global
    ),
    gp_variance_trend: buildVarianceTrendFromPeriods(
      periods,
      lines,
      (v) => v.variance_amount.gp,
      global
    ),
    collections_variance_trend: buildVarianceTrendFromPeriods(
      periods,
      lines,
      (v) => v.variance_amount.collections,
      global
    ),
    budget_trend: buildBudgetMetricTrend(periods, lines, "revenue_budget"),
    forecast_trend: forecast_global
      ? [{ period: "FY", label: String(input.fiscalYear), value: forecast_global.metrics.revenue_budget }]
      : [],
    margin_trend: buildBudgetMetricTrend(periods, lines, "gp_budget"),
  };

  const sorted = sortVariancesByMetric(clientVar.variances, "revenue");

  if (process.env.NODE_ENV === "development") {
    devLog("[planning-dashboard] loaded", {
      versionId,
      clientSlices: clientVar.variances.length,
    });
  }

  return {
    kpis,
    charts,
    global_variance: global,
    top_positive: sortVariancesByMetric(sorted, "revenue", "desc").slice(0, 10),
    top_negative: sortVariancesByMetric(sorted, "revenue", "asc").slice(0, 10),
    client_variance: clientVar.variances.slice(0, 15),
    brand_variance: brandVar.variances.slice(0, 15),
    country_variance: countryVar.variances.slice(0, 15),
    drilldown_rollups: drilldown.nodes,
    forecast_global,
    currency,
  };
}
