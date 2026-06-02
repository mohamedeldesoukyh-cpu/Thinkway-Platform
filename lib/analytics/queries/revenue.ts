import type { SupabaseClient } from "@supabase/supabase-js";

import {
  rollupFacts,
  rollupGlobal,
} from "@/lib/analytics/aggregations/rollup-engine";
import {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
import { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type {
  AnalyticsCategoryPoint,
  RevenueAnalyticsOutput,
} from "@/lib/analytics/types/outputs";

export async function getRevenueAnalytics(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<RevenueAnalyticsOutput> {
  const cacheKey = buildAnalyticsCacheKey("revenue", {
    billing: filters.billingFilter ?? "all",
    from: filters.dateRange?.from,
  });

  return withAnalyticsCache(cacheKey, async () => {
    const snapshot = await loadAnalyticsFacts(supabase, filters);
    const global = rollupGlobal(snapshot.facts);
    const currencies = snapshot.facts.map((f) => f.currency_code);

    const kpis = buildKpiStripFromMetrics(global.metrics, currencies, [
      { id: "revenue", label: "Revenue", pick: (m) => m.revenue },
      { id: "achieved", label: "Achieved revenue", pick: (m) => m.achieved_revenue },
      {
        id: "unachieved",
        label: "Unachieved revenue",
        pick: (m) => m.unachieved_revenue,
      },
      { id: "invoiced", label: "Invoiced revenue", pick: (m) => m.invoiced_revenue },
    ]);

    const by_client: AnalyticsCategoryPoint[] = rollupFacts(
      snapshot.facts,
      "client",
      filters
    ).map((n) => ({
      key: n.key,
      label: n.label,
      value: n.metrics.revenue,
      metrics: n.metrics,
    }));

    const by_brand: AnalyticsCategoryPoint[] = rollupFacts(
      snapshot.facts,
      "brand",
      filters
    ).map((n) => ({
      key: n.key,
      label: n.label,
      value: n.metrics.revenue,
      metrics: n.metrics,
    }));

    const ranking = rollupFacts(snapshot.facts, "campaign", filters)
      .slice(0, 25)
      .map((node, index) => ({
        rank: index + 1,
        key: node.key,
        label: node.label,
        currency_code: node.currency.primary_currency ?? "USD",
        metrics: node.metrics,
      }));

    return {
      kpis,
      by_client,
      by_brand,
      time_series: [],
      ranking,
    };
  });
}
