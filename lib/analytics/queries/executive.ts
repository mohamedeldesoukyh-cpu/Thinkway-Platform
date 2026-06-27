import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupFacts, rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import {
  buildAnalyticsCacheKey,
  withAnalyticsCache,
} from "@/lib/analytics/aggregations/memo";
import { computeAgingBucket } from "@/lib/domains/billing/types";
import { AGING_BUCKET_LABELS } from "@/lib/domains/billing/constants";
import type { AgingBucket } from "@/lib/domains/billing/types";
import { loadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type {
  AnalyticsAgingRow,
  AnalyticsCategoryPoint,
  AnalyticsChartBundle,
  AnalyticsRankingRow,
  AnalyticsTimeSeriesPoint,
  ExecutiveAnalyticsOutput,
} from "@/lib/analytics/types/outputs";
import { roundMoney } from "@/lib/analytics/aggregations/round";

function buildTimeSeries(
  invoices: Awaited<ReturnType<typeof loadAnalyticsFacts>>["invoices"]
): AnalyticsTimeSeriesPoint[] {
  const byMonth = new Map<string, AnalyticsTimeSeriesPoint>();

  for (const inv of invoices) {
    if (!inv.issue_date) continue;
    const period = inv.issue_date.slice(0, 7);
    const bucket =
      byMonth.get(period) ??
      {
        period,
        label: period,
        metrics: {
          revenue: 0,
          invoiced_revenue: 0,
          collected_revenue: 0,
          gp: 0,
        },
      };
    bucket.metrics.invoiced_revenue = roundMoney(
      bucket.metrics.invoiced_revenue + Number(inv.total)
    );
    bucket.metrics.collected_revenue = roundMoney(
      bucket.metrics.collected_revenue + Number(inv.amount_paid)
    );
    byMonth.set(period, bucket);
  }

  return [...byMonth.values()].sort((a, b) => a.period.localeCompare(b.period));
}

function buildAgingTable(
  invoices: Awaited<ReturnType<typeof loadAnalyticsFacts>>["invoices"]
): AnalyticsAgingRow[] {
  const map = new Map<AgingBucket, AnalyticsAgingRow>();
  for (const key of Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]) {
    map.set(key, { bucket: key, label: AGING_BUCKET_LABELS[key], count: 0, amount: 0 });
  }

  for (const inv of invoices) {
    const outstanding = Math.max(0, Number(inv.total) - Number(inv.amount_paid));
    if (outstanding <= 0) continue;
    const bucket = computeAgingBucket(inv.due_date, outstanding);
    const row = map.get(bucket)!;
    row.count += 1;
    row.amount = roundMoney(row.amount + outstanding);
  }

  return [...map.values()];
}

function buildClientRanking(
  facts: Awaited<ReturnType<typeof loadAnalyticsFacts>>["facts"]
): AnalyticsRankingRow[] {
  const byClient = new Map<string, AnalyticsRankingRow>();

  for (const fact of facts) {
    const existing = byClient.get(fact.client_id);
    if (!existing) {
      byClient.set(fact.client_id, {
        rank: 0,
        key: fact.client_id,
        label: fact.client_name,
        currency_code: fact.currency_code,
        metrics: { ...fact.metrics },
      });
      continue;
    }
    existing.metrics.revenue = roundMoney(
      existing.metrics.revenue + fact.metrics.revenue
    );
    existing.metrics.gp = roundMoney(existing.metrics.gp + fact.metrics.gp);
    existing.metrics.invoiced_revenue = roundMoney(
      existing.metrics.invoiced_revenue + fact.metrics.invoiced_revenue
    );
  }

  return [...byClient.values()]
    .sort((a, b) => b.metrics.revenue - a.metrics.revenue)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function getExecutiveKpis(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<ExecutiveAnalyticsOutput> {
  const cacheKey = buildAnalyticsCacheKey("executive", {
    billing: filters.billingFilter ?? "all",
    operational: filters.operationalFilter ?? "all",
    from: filters.dateRange?.from,
    to: filters.dateRange?.to,
  });

  return withAnalyticsCache(cacheKey, async () => {
    const snapshot = await loadAnalyticsFacts(supabase, filters);
    const global = rollupGlobal(snapshot.facts);
    const currencies = snapshot.facts.map((f) => f.currency_code);

    const kpis = buildKpiStripFromMetrics(global.metrics, currencies, [
      { id: "revenue", label: "Revenue", pick: (m) => m.revenue },
      { id: "achieved", label: "Achieved revenue", pick: (m) => m.achieved_revenue },
      { id: "invoiced", label: "Invoiced", pick: (m) => m.invoiced_revenue },
      { id: "collected", label: "Collected", pick: (m) => m.collected_revenue },
      { id: "outstanding", label: "Outstanding", pick: (m) => m.outstanding_revenue },
      { id: "gp", label: "GP", pick: (m) => m.gp },
      {
        id: "margin",
        label: "Margin %",
        pick: (m) => m.margin_percent,
        decimals: 1,
      },
      { id: "vendor", label: "Vendor payable", pick: (m) => m.vendor_payable },
    ]);

    const pie_series: AnalyticsCategoryPoint[] = rollupFacts(
      snapshot.facts,
      "client",
      filters
    )
      .slice(0, 8)
      .map((node) => ({
        key: node.key,
        label: node.label,
        value: node.metrics.revenue,
      }));

    const charts: AnalyticsChartBundle = {
      time_series: buildTimeSeries(snapshot.invoices),
      bar_series: pie_series,
      pie_series,
      ranking_table: buildClientRanking(snapshot.facts),
      aging_table: buildAgingTable(snapshot.invoices),
    };

    return {
      kpis,
      rollups: [
        global,
        ...rollupFacts(snapshot.facts, "client", filters).slice(0, 20),
        ...rollupFacts(snapshot.facts, "brand", filters).slice(0, 20),
      ],
      charts,
      facts_count: snapshot.facts.length,
    };
  });
}
