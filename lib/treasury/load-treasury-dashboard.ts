import type { SupabaseClient } from "@supabase/supabase-js";

import { rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import { loadPlanningAnalyticsSnapshot } from "@/lib/analytics/planning/snapshot";
import { buildAgingSummary } from "@/lib/collections/aging";
import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import { buildCashflowForecast, type CashflowForecastResult } from "@/lib/treasury/cashflow-forecast";
import { loadVendorPayables } from "@/lib/vendor-payables/load-payables";
import { devLog } from "@/lib/platform/logger";

export type TreasuryKpiCard = {
  id: string;
  label: string;
  formatted: string;
  value: number;
};

export type TreasuryDashboardPayload = {
  kpis: TreasuryKpiCard[];
  cashflow: CashflowForecastResult;
  charts: {
    cashflow_trend: { label: string; value: number }[];
    collections_trend: { label: string; value: number }[];
    payout_trend: { label: string; value: number }[];
    liquidity_forecast: { label: string; value: number }[];
  };
  currency: ReturnType<typeof buildCurrencyContext>;
};

export async function loadTreasuryDashboard(
  supabase: SupabaseClient
): Promise<TreasuryDashboardPayload> {
  const [snapshot, invoices, payables, planning] = await Promise.all([
    safeLoadAnalyticsFacts(supabase),
    loadCollectionInvoices(supabase, { limit: 500 }),
    loadVendorPayables(supabase),
    loadPlanningAnalyticsSnapshot(supabase).catch(() => null),
  ]);

  const global = rollupGlobal(snapshot.facts);
  const aging = buildAgingSummary(invoices);
  const currency = buildCurrencyContext(snapshot.facts.map((f) => f.currency_code));
  const format = (n: number) => formatAnalyticsAmount(n, currency, { decimals: 0 });

  const planningMetrics = planning?.global_metrics?.planning;
  const cashflow = buildCashflowForecast({
    invoices,
    vendor_payable_total: payables.total_pending,
    planning_collections_forecast: planningMetrics?.collections_budget,
    planning_payout_forecast: planningMetrics?.vendor_cost_budget,
  });

  const kpis: TreasuryKpiCard[] = [
    {
      id: "cash_in",
      label: "Expected cash in",
      value: cashflow.expected_collections,
      formatted: format(cashflow.expected_collections),
    },
    {
      id: "cash_out",
      label: "Expected cash out",
      value: cashflow.expected_payouts,
      formatted: format(cashflow.expected_payouts),
    },
    {
      id: "net",
      label: "Net cashflow",
      value: cashflow.net_cashflow,
      formatted: format(cashflow.net_cashflow),
    },
    {
      id: "vendor_exposure",
      label: "Vendor exposure",
      value: payables.total_pending,
      formatted: format(payables.total_pending),
    },
    {
      id: "ar",
      label: "Outstanding AR",
      value: aging.total_outstanding,
      formatted: format(aging.total_outstanding),
    },
    {
      id: "ap",
      label: "Outstanding AP",
      value: payables.total_pending,
      formatted: format(payables.total_pending),
    },
  ];

  const charts = {
    cashflow_trend: cashflow.weekly.map((p) => ({
      label: p.label,
      value: p.net,
    })),
    collections_trend: cashflow.weekly.map((p) => ({
      label: p.label,
      value: p.expected_in,
    })),
    payout_trend: cashflow.weekly.map((p) => ({
      label: p.label,
      value: p.expected_out,
    })),
    liquidity_forecast: cashflow.monthly.map((p) => ({
      label: p.label,
      value: p.net,
    })),
  };

  if (process.env.NODE_ENV === "development") {
    devLog("[treasury] dashboard loaded", {
      ar: aging.total_outstanding,
      ap: payables.total_pending,
      globalOutstanding: global.metrics.outstanding_revenue,
    });
  }

  return { kpis, cashflow, charts, currency };
}
