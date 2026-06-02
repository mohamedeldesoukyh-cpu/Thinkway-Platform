import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import {
  enrichMetricsWithPlanning,
  varianceToPlanningKpis,
  type PlanningVarianceKpi,
} from "@/lib/analytics/planning/budget-integration";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { FinancialMetrics } from "@/lib/analytics/types/metrics";
import { devLog } from "@/lib/dev-log";
import { loadApprovedBudgetVersion } from "@/lib/planning/queries/load-budget-versions";
import { loadBudgetVariance } from "@/lib/planning/queries/load-budget-variance";

export type PlanningAnalyticsSnapshot = {
  fiscal_year: number | null;
  budget_version_id: string | null;
  global_metrics: FinancialMetrics;
  variance_kpis: PlanningVarianceKpi[];
};

/**
 * Loads approved budget variance and merges planning slice into global analytics metrics.
 * Safe no-op when no approved budget exists for the fiscal year.
 */
export async function loadPlanningAnalyticsSnapshot(
  supabase: SupabaseClient,
  options: {
    fiscalYear?: number;
    filters?: AnalyticsQueryFilters;
  } = {}
): Promise<PlanningAnalyticsSnapshot> {
  const fiscalYear = options.fiscalYear ?? new Date().getFullYear();
  const filters = options.filters ?? {};

  const snapshot = await safeLoadAnalyticsFacts(supabase, filters);
  let globalMetrics = rollupGlobal(snapshot.facts).metrics;

  const approved = await loadApprovedBudgetVersion(supabase, fiscalYear);
  if (!approved) {
    if (process.env.NODE_ENV === "development") {
      devLog("[planning-query] no approved budget for fiscal year", { fiscalYear });
    }
    return {
      fiscal_year: fiscalYear,
      budget_version_id: null,
      global_metrics: globalMetrics,
      variance_kpis: [],
    };
  }

  const variance = await loadBudgetVariance(
    supabase,
    approved.id,
    "global",
    filters
  );

  globalMetrics = enrichMetricsWithPlanning(globalMetrics, variance.global.budget);

  return {
    fiscal_year: fiscalYear,
    budget_version_id: approved.id,
    global_metrics: globalMetrics,
    variance_kpis: varianceToPlanningKpis(variance.global),
  };
}
