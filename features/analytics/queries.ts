import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getCollectionsAnalytics,
  getExecutiveKpis,
  getOperationalAnalytics,
  getProfitabilityAnalytics,
  getRevenueAnalytics,
} from "@/lib/analytics";
import type { AnalyticsQueryFilters } from "@/lib/analytics";
import { DEFAULT_ANALYTICS_FILTERS } from "@/lib/analytics/types/filters";

async function requireAnalyticsSupabase() {
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

export async function loadExecutiveAnalytics(
  filters: AnalyticsQueryFilters = DEFAULT_ANALYTICS_FILTERS
) {
  const supabase = await requireAnalyticsSupabase();
  return getExecutiveKpis(supabase, filters);
}

export async function loadRevenueAnalytics(
  filters: AnalyticsQueryFilters = DEFAULT_ANALYTICS_FILTERS
) {
  const supabase = await requireAnalyticsSupabase();
  return getRevenueAnalytics(supabase, filters);
}

export async function loadProfitabilityAnalytics(
  filters: AnalyticsQueryFilters = DEFAULT_ANALYTICS_FILTERS
) {
  const supabase = await requireAnalyticsSupabase();
  return getProfitabilityAnalytics(supabase, filters);
}

export async function loadCollectionsAnalytics(
  filters: AnalyticsQueryFilters = DEFAULT_ANALYTICS_FILTERS
) {
  const supabase = await requireAnalyticsSupabase();
  return getCollectionsAnalytics(supabase, filters);
}

export async function loadOperationalAnalytics(
  filters: AnalyticsQueryFilters = DEFAULT_ANALYTICS_FILTERS
) {
  const supabase = await requireAnalyticsSupabase();
  return getOperationalAnalytics(supabase, filters);
}
