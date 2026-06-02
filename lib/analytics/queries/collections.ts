import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupFacts, rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
import { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
import { computeAgingBucket } from "@/features/billing/types";
import { AGING_BUCKET_LABELS } from "@/features/billing/constants";
import type { AgingBucket } from "@/features/billing/types";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { CollectionsAnalyticsOutput } from "@/lib/analytics/types/outputs";

export async function getCollectionsAnalytics(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<CollectionsAnalyticsOutput> {
  const cacheKey = buildAnalyticsCacheKey("collections", {
    invoice: filters.invoiceFilter ?? "all",
  });

  return withAnalyticsCache(cacheKey, async () => {
    const snapshot = await loadAnalyticsFacts(supabase, filters);
    const global = rollupGlobal(snapshot.facts);
    const currencies = snapshot.facts.map((f) => f.currency_code);

    const kpis = buildKpiStripFromMetrics(global.metrics, currencies, [
      { id: "collected", label: "Collected", pick: (m) => m.collected_revenue },
      {
        id: "outstanding",
        label: "Outstanding",
        pick: (m) => m.outstanding_revenue,
        alert:
          global.metrics.outstanding_revenue > 0 ? "warning" : "default",
      },
      { id: "invoiced", label: "Invoiced", pick: (m) => m.invoiced_revenue },
    ]);

    const agingMap = new Map<AgingBucket, { bucket: AgingBucket; label: string; count: number; amount: number }>();
    for (const key of Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]) {
      agingMap.set(key, {
        bucket: key,
        label: AGING_BUCKET_LABELS[key],
        count: 0,
        amount: 0,
      });
    }

    for (const inv of snapshot.invoices) {
      const outstanding = roundMoney(
        Math.max(0, Number(inv.total) - Number(inv.amount_paid))
      );
      if (outstanding <= 0) continue;
      const bucket = computeAgingBucket(inv.due_date, outstanding);
      const row = agingMap.get(bucket)!;
      row.count += 1;
      row.amount = roundMoney(row.amount + outstanding);
    }

    const outstanding_by_client = rollupFacts(snapshot.facts, "client", filters)
      .filter((n) => n.metrics.outstanding_revenue > 0)
      .map((n) => ({
        key: n.key,
        label: n.label,
        value: n.metrics.outstanding_revenue,
      }));

    return {
      kpis,
      aging: [...agingMap.values()],
      outstanding_by_client,
      collection_time_series: [],
    };
  });
}
