import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPlanningAnalyticsSnapshot } from "@/lib/analytics/planning/snapshot";
import type { AnalyticsQueryFilters } from "@/lib/analytics";
import {
  loadBudgetPeriods,
  loadBudgetRollups,
  loadBudgetVariance,
  loadBudgetVersions,
  loadForecastRollups,
  loadForecastVersions,
} from "@/lib/planning";

async function requirePlanningSupabase() {
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

export async function fetchBudgetVersions(
  options: Parameters<typeof loadBudgetVersions>[1] = {}
) {
  const supabase = await requirePlanningSupabase();
  return loadBudgetVersions(supabase, options);
}

export async function fetchBudgetPeriods(budgetVersionId: string) {
  const supabase = await requirePlanningSupabase();
  return loadBudgetPeriods(supabase, budgetVersionId);
}

export async function fetchBudgetRollups(
  budgetVersionId: string,
  level: Parameters<typeof loadBudgetRollups>[2] = "global",
  filters?: AnalyticsQueryFilters
) {
  const supabase = await requirePlanningSupabase();
  return loadBudgetRollups(supabase, budgetVersionId, level, filters);
}

export async function fetchBudgetVariance(
  budgetVersionId: string,
  level: Parameters<typeof loadBudgetVariance>[2] = "client",
  filters?: AnalyticsQueryFilters
) {
  const supabase = await requirePlanningSupabase();
  return loadBudgetVariance(supabase, budgetVersionId, level, filters);
}

export async function fetchForecastRollups(
  forecastVersionId: string,
  level: Parameters<typeof loadForecastRollups>[2] = "global"
) {
  const supabase = await requirePlanningSupabase();
  return loadForecastRollups(supabase, forecastVersionId, level);
}

export async function fetchForecastVersions(
  options: Parameters<typeof loadForecastVersions>[1] = {}
) {
  const supabase = await requirePlanningSupabase();
  return loadForecastVersions(supabase, options);
}

export async function fetchPlanningAnalyticsSnapshot(
  options: Parameters<typeof loadPlanningAnalyticsSnapshot>[1] = {}
) {
  const supabase = await requirePlanningSupabase();
  return loadPlanningAnalyticsSnapshot(supabase, options);
}
