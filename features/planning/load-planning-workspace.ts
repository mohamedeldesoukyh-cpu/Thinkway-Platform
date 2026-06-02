import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { loadDashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import type { DashboardFilterOptions } from "@/features/analytics/load-executive-dashboard";
import {
  planningFiltersToAnalytics,
  type PlanningFilterState,
} from "@/lib/planning/dashboard-filters";
import { loadBudgetAllocations } from "@/lib/planning/queries/load-budget-allocations";
import {
  loadPlanningDashboard,
  type PlanningDashboardPayload,
} from "@/lib/planning/queries/load-planning-dashboard";
import {
  loadBudgetVersions,
  loadForecastVersions,
  loadBudgetVariance,
  loadForecastRollups,
  loadBudgetRollups,
} from "@/lib/planning";
import type { BudgetVersion } from "@/lib/planning/types/budget";
import type { ForecastVersion } from "@/lib/planning/types/forecast";
import type { BudgetAllocation } from "@/lib/planning/types/budget";
import type { BudgetVarianceResult } from "@/lib/planning/queries/load-budget-variance";
import type { ForecastRollupsResult } from "@/lib/planning/queries/load-forecast-rollups";
import type { BudgetRollupsResult } from "@/lib/planning/queries/load-budget-rollups";
import { devLog } from "@/lib/platform/logger";
import { safePlanningQuery } from "@/lib/platform/safe-query";

export type PlanningPermissions = {
  canRead: boolean;
  canWrite: boolean;
  canApprove: boolean;
  canForecast: boolean;
};

export type PlanningWorkspacePayload = {
  fiscalYear: number;
  filterState: PlanningFilterState;
  versions: BudgetVersion[];
  forecasts: ForecastVersion[];
  selectedVersionId: string | null;
  selectedForecastId: string | null;
  dashboard: PlanningDashboardPayload;
  variance: BudgetVarianceResult | null;
  forecastRollups: ForecastRollupsResult | null;
  budgetRollups: BudgetRollupsResult | null;
  allocations: BudgetAllocation[];
  permissions: PlanningPermissions;
  filterOptions: DashboardFilterOptions;
  queryWarnings: string[];
};

const EMPTY_DASHBOARD: PlanningDashboardPayload = {
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
  currency: {
    primary_currency: "USD",
    currencies: [],
    is_mixed_currency: false,
    mixed_label: null,
  },
};

async function requireSupabase() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return supabase;
}

async function resolvePlanningPermissions(
  supabase: Awaited<ReturnType<typeof requireSupabase>>
): Promise<PlanningPermissions> {
  const [canRead, canWrite, canApprove, canForecast] = await Promise.all([
    hasPermission(supabase, "planning.read"),
    hasPermission(supabase, "planning.write"),
    hasPermission(supabase, "planning.approve"),
    hasPermission(supabase, "planning.forecast"),
  ]);
  return { canRead, canWrite, canApprove, canForecast };
}

export async function loadPlanningWorkspace(
  filterState: PlanningFilterState
): Promise<PlanningWorkspacePayload> {
  const supabase = await requireSupabase();
  const fiscalYear = filterState.fiscalYear
    ? Number.parseInt(filterState.fiscalYear, 10)
    : new Date().getFullYear();
  const analyticsFilters = planningFiltersToAnalytics(filterState);
  const queryWarnings: string[] = [];

  const [permissions, filterOptions, versionsResult, forecastsResult] =
    await Promise.all([
      resolvePlanningPermissions(supabase),
      loadDashboardFilterOptions().catch(() => ({
        clients: [],
        brands: [],
        countries: [],
        currencies: ["USD"],
      })),
      safePlanningQuery(
        "budget-versions",
        () => loadBudgetVersions(supabase, { fiscalYear }),
        [] as BudgetVersion[]
      ),
      safePlanningQuery(
        "forecast-versions",
        () => loadForecastVersions(supabase, { fiscalYear }),
        [] as ForecastVersion[]
      ),
    ]);

  if (!versionsResult.ok) queryWarnings.push(versionsResult.error ?? "Versions unavailable");
  if (!forecastsResult.ok) queryWarnings.push(forecastsResult.error ?? "Forecasts unavailable");

  const versions = versionsResult.data;
  const forecasts = forecastsResult.data;

  const selectedVersionId =
    filterState.versionId ?? versions.find((v) => v.status === "approved")?.id ?? versions[0]?.id ?? null;
  const selectedForecastId =
    filterState.forecastId ?? forecasts[0]?.id ?? null;

  const dashboardResult = await safePlanningQuery(
    "planning-dashboard",
    () =>
      loadPlanningDashboard(supabase, {
        budgetVersionId: selectedVersionId,
        forecastVersionId: selectedForecastId,
        fiscalYear,
        analyticsFilters,
      }),
    EMPTY_DASHBOARD
  );
  if (!dashboardResult.ok) {
    queryWarnings.push(dashboardResult.error ?? "Dashboard unavailable");
  }

  let variance: BudgetVarianceResult | null = null;
  if (selectedVersionId) {
    const varianceResult = await safePlanningQuery(
      "budget-variance",
      () => loadBudgetVariance(supabase, selectedVersionId, "client", analyticsFilters),
      null
    );
    variance = varianceResult.data;
    if (!varianceResult.ok) queryWarnings.push(varianceResult.error ?? "Variance unavailable");
  }

  let forecastRollups: ForecastRollupsResult | null = null;
  if (selectedForecastId) {
    const forecastResult = await safePlanningQuery(
      "forecast-rollups",
      () => loadForecastRollups(supabase, selectedForecastId, "client"),
      null
    );
    forecastRollups = forecastResult.data;
    if (!forecastResult.ok) queryWarnings.push(forecastResult.error ?? "Forecast rollups unavailable");
  }

  let budgetRollups: BudgetRollupsResult | null = null;
  if (selectedVersionId) {
    const rollupsResult = await safePlanningQuery(
      "budget-rollups-drilldown",
      () => loadBudgetRollups(supabase, selectedVersionId, "country", analyticsFilters),
      null
    );
    budgetRollups = rollupsResult.data;
  }

  let allocations: BudgetAllocation[] = [];
  if (selectedVersionId) {
    const allocResult = await safePlanningQuery(
      "budget-allocations",
      () => loadBudgetAllocations(supabase, selectedVersionId),
      [] as BudgetAllocation[]
    );
    allocations = allocResult.data;
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[budget-workspace] loaded", {
      fiscalYear,
      versions: versions.length,
      versionId: selectedVersionId,
      warnings: queryWarnings.length,
    });
  }

  return {
    fiscalYear,
    filterState,
    versions,
    forecasts,
    selectedVersionId,
    selectedForecastId,
    dashboard: dashboardResult.data,
    variance,
    forecastRollups,
    budgetRollups,
    allocations,
    permissions,
    filterOptions,
    queryWarnings,
  };
}
