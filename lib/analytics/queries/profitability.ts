import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupFacts, rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
import { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { ProfitabilityAnalyticsOutput } from "@/lib/analytics/types/outputs";

export async function getProfitabilityAnalytics(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<ProfitabilityAnalyticsOutput> {
  const cacheKey = buildAnalyticsCacheKey("profitability", {
    billing: filters.billingFilter ?? "all",
  });

  return withAnalyticsCache(cacheKey, async () => {
    const snapshot = await loadAnalyticsFacts(supabase, filters);
    const global = rollupGlobal(snapshot.facts);
    const currencies = snapshot.facts.map((f) => f.currency_code);

    const kpis = buildKpiStripFromMetrics(global.metrics, currencies, [
      { id: "gp", label: "Gross profit", pick: (m) => m.gp },
      { id: "cost", label: "Cost", pick: (m) => m.cost },
      {
        id: "margin",
        label: "Margin %",
        pick: (m) => m.margin_percent,
        decimals: 1,
      },
      { id: "revenue", label: "Revenue", pick: (m) => m.revenue },
    ]);

    const margin_by_client = rollupFacts(snapshot.facts, "client", filters).map(
      (node) => ({
        key: node.key,
        label: node.label,
        value: node.metrics.margin_percent,
        metrics: node.metrics,
      })
    );

    const gp_ranking = rollupFacts(snapshot.facts, "client", filters)
      .sort((a, b) => b.metrics.gp - a.metrics.gp)
      .slice(0, 20)
      .map((node, index) => ({
        rank: index + 1,
        key: node.key,
        label: node.label,
        currency_code: node.currency.primary_currency ?? "USD",
        metrics: node.metrics,
      }));

    return {
      kpis,
      margin_by_client,
      gp_ranking,
      time_series: [],
    };
  });
}
