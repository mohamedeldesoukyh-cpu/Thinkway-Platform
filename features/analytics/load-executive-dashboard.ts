import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rollupFacts } from "@/lib/analytics/aggregations/rollup-engine";
import { rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import {
  buildExecutiveDashboardCharts,
  type ExecutiveDashboardCharts,
} from "@/lib/analytics/queries/dashboard-charts";
import { buildFinanceAlerts, type FinanceAlertsPayload } from "@/lib/analytics/queries/dashboard-alerts";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { buildKpiStripFromMetrics } from "@/lib/analytics/queries/kpi-builder";
import {
  getCollectionsAnalytics,
  getExecutiveKpis,
  getOperationalAnalytics,
  getProfitabilityAnalytics,
  getRevenueAnalytics,
} from "@/lib/analytics";
import type { AnalyticsQueryFilters } from "@/lib/analytics";
import type {
  AnalyticsKpiStrip,
  CollectionsAnalyticsOutput,
  ExecutiveAnalyticsOutput,
  OperationalAnalyticsOutput,
  ProfitabilityAnalyticsOutput,
  RevenueAnalyticsOutput,
} from "@/lib/analytics";
import type { AnalyticsRollupNode } from "@/lib/analytics/types/metrics";
import { devLog } from "@/lib/dev-log";

export type ExecutiveDashboardMeta = {
  active_campaigns: number;
  po_remaining: number;
  unbilled_achieved_revenue: number;
};

export type ExecutiveDashboardPayload = {
  executive: ExecutiveAnalyticsOutput;
  revenue: RevenueAnalyticsOutput;
  profitability: ProfitabilityAnalyticsOutput;
  collections: CollectionsAnalyticsOutput;
  operational: OperationalAnalyticsOutput;
  charts: ExecutiveDashboardCharts;
  alerts: FinanceAlertsPayload;
  executive_kpis: AnalyticsKpiStrip;
  meta: ExecutiveDashboardMeta;
  profitability_tables: {
    top_clients: AnalyticsRollupNode[];
    lowest_margin_clients: AnalyticsRollupNode[];
    top_campaigns: AnalyticsRollupNode[];
    country_profitability: AnalyticsRollupNode[];
    brand_profitability: AnalyticsRollupNode[];
  };
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

export async function loadExecutiveDashboard(
  filters: AnalyticsQueryFilters = {}
): Promise<ExecutiveDashboardPayload> {
  const supabase = await requireSupabase();

  const settled = await Promise.allSettled([
    getExecutiveKpis(supabase, filters),
    getRevenueAnalytics(supabase, filters),
    getProfitabilityAnalytics(supabase, filters),
    getCollectionsAnalytics(supabase, filters),
    getOperationalAnalytics(supabase, filters),
    safeLoadAnalyticsFacts(supabase, filters),
  ]);

  const snapshot =
    settled[5].status === "fulfilled"
      ? settled[5].value
      : { facts: [], invoices: [], loaded_at: new Date().toISOString() };

  if (settled.some((r, i) => i < 5 && r.status === "rejected")) {
    if (process.env.NODE_ENV === "development") {
      devLog(
        "[dashboard-resilience] partial executive analytics failure",
        settled.map((r) => (r.status === "rejected" ? r.reason : null))
      );
    }
  }

  const executive =
    settled[0].status === "fulfilled"
      ? settled[0].value
      : {
          kpis: { cards: [], currency: { primary_currency: null, is_mixed_currency: false, currencies: [], mixed_label: null }, generated_at: new Date().toISOString() },
          rollups: [],
          charts: { time_series: [], bar_series: [], pie_series: [], ranking_table: [], aging_table: [] },
          facts_count: 0,
        };
  const revenue =
    settled[1].status === "fulfilled"
      ? settled[1].value
      : { kpis: executive.kpis, by_client: [], by_brand: [], time_series: [], ranking: [] };
  const profitability =
    settled[2].status === "fulfilled"
      ? settled[2].value
      : { kpis: executive.kpis, margin_by_client: [], gp_ranking: [], time_series: [] };
  const collections =
    settled[3].status === "fulfilled"
      ? settled[3].value
      : { kpis: executive.kpis, aging: [], outstanding_by_client: [], collection_time_series: [] };
  const operational =
    settled[4].status === "fulfilled"
      ? settled[4].value
      : {
          kpis: executive.kpis,
          achieved_vs_unachieved: [],
          invoiced_vs_remaining: [],
          by_campaign: [],
        };

  const global = rollupGlobal(snapshot.facts);
  const currencies = snapshot.facts.map((f) => f.currency_code);

  const executive_kpis = buildKpiStripFromMetrics(global.metrics, currencies, [
    { id: "revenue", label: "Revenue", pick: (m) => m.revenue },
    { id: "gp", label: "GP", pick: (m) => m.gp },
    { id: "margin", label: "Margin %", pick: (m) => m.margin_percent, decimals: 1 },
    { id: "invoiced", label: "Total invoiced", pick: (m) => m.invoiced_revenue },
    { id: "collected", label: "Collected", pick: (m) => m.collected_revenue },
    { id: "outstanding", label: "Outstanding", pick: (m) => m.outstanding_revenue },
    { id: "vendor", label: "Vendor payable", pick: (m) => m.vendor_payable },
    {
      id: "unbilled",
      label: "Unbilled achieved revenue",
      pick: (m) => m.remaining_to_invoice,
    },
    {
      id: "po_remaining",
      label: "PO remaining",
      pick: (m) => Math.max(0, m.budget_variance),
    },
    {
      id: "active_campaigns",
      label: "Active campaigns",
      pick: (_m) => snapshot.facts.length,
      decimals: 0,
    },
  ]);

  const clientNodes = rollupFacts(snapshot.facts, "client", filters);
  const campaignNodes = rollupFacts(snapshot.facts, "campaign", filters);

  const charts = buildExecutiveDashboardCharts(snapshot);
  const alerts = buildFinanceAlerts({ snapshot, collections, filters });

  const payload: ExecutiveDashboardPayload = {
    executive,
    revenue,
    profitability,
    collections,
    operational,
    charts,
    alerts,
    executive_kpis,
    meta: {
      active_campaigns: snapshot.facts.length,
      po_remaining: Math.max(0, global.metrics.budget_variance),
      unbilled_achieved_revenue: global.metrics.remaining_to_invoice,
    },
    profitability_tables: {
      top_clients: clientNodes.slice(0, 15),
      lowest_margin_clients: [...clientNodes]
        .filter((n) => n.metrics.revenue > 0)
        .sort((a, b) => a.metrics.margin_percent - b.metrics.margin_percent)
        .slice(0, 15),
      top_campaigns: campaignNodes.slice(0, 15),
      country_profitability: rollupFacts(snapshot.facts, "country", filters).slice(
        0,
        15
      ),
      brand_profitability: rollupFacts(snapshot.facts, "brand", filters).slice(0, 15),
    },
  };

  if (process.env.NODE_ENV === "development") {
    devLog("[executive-dashboard] payload loaded", {
      campaigns: payload.meta.active_campaigns,
      alerts: payload.alerts.alerts.length,
    });
  }

  return payload;
}

export type DashboardFilterOptions = {
  clients: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  countries: string[];
  currencies: string[];
};

export async function loadDashboardFilterOptions(): Promise<DashboardFilterOptions> {
  const supabase = await requireSupabase();

  const [clientsResult, brandsResult] = await Promise.all([
    supabase.from("clients").select("id, name").order("name").limit(200),
    supabase.from("brands").select("id, name").order("name").limit(200),
  ]);

  if (clientsResult.error) throw new Error(clientsResult.error.message);
  if (brandsResult.error) throw new Error(brandsResult.error.message);

  const snapshot = await safeLoadAnalyticsFacts(supabase);
  const countries = [
    ...new Set(
      snapshot.facts
        .map((f) => f.country_code)
        .filter((c): c is string => Boolean(c))
    ),
  ].sort();
  const currencies = [
    ...new Set(snapshot.facts.map((f) => f.currency_code)),
  ].sort();

  return {
    clients: (clientsResult.data ?? []) as { id: string; name: string }[],
    brands: (brandsResult.data ?? []) as { id: string; name: string }[],
    countries,
    currencies,
  };
}
