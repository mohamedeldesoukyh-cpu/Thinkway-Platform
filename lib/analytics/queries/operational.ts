import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupFacts, rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
import { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { OperationalAnalyticsOutput } from "@/lib/analytics/types/outputs";

export async function getOperationalAnalytics(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<OperationalAnalyticsOutput> {
  const cacheKey = buildAnalyticsCacheKey("operational", {
    operational: filters.operationalFilter ?? "all",
  });

  return withAnalyticsCache(cacheKey, async () => {
    const snapshot = await loadAnalyticsFacts(supabase, filters);
    const global = rollupGlobal(snapshot.facts);
    const currencies = snapshot.facts.map((f) => f.currency_code);

    const kpis = buildKpiStripFromMetrics(global.metrics, currencies, [
      { id: "achieved", label: "Achieved revenue", pick: (m) => m.achieved_revenue },
      {
        id: "unachieved",
        label: "Unachieved revenue",
        pick: (m) => m.unachieved_revenue,
      },
      {
        id: "remaining",
        label: "Remaining to invoice",
        pick: (m) => m.remaining_to_invoice,
      },
      { id: "invoiced", label: "Invoiced", pick: (m) => m.invoiced_revenue },
    ]);

    const achieved_vs_unachieved = [
      {
        key: "achieved",
        label: "Achieved",
        value: global.metrics.achieved_revenue,
      },
      {
        key: "unachieved",
        label: "Unachieved",
        value: global.metrics.unachieved_revenue,
      },
    ];

    const invoiced_vs_remaining = [
      {
        key: "invoiced",
        label: "Invoiced",
        value: global.metrics.invoiced_revenue,
      },
      {
        key: "remaining",
        label: "Remaining to invoice",
        value: global.metrics.remaining_to_invoice,
      },
    ];

    const by_campaign = rollupFacts(snapshot.facts, "campaign", filters)
      .slice(0, 30)
      .map((node, index) => ({
        rank: index + 1,
        key: node.key,
        label: node.label,
        currency_code: node.currency.primary_currency ?? "USD",
        metrics: node.metrics,
      }));

    return {
      kpis,
      achieved_vs_unachieved,
      invoiced_vs_remaining,
      by_campaign,
    };
  });
}
