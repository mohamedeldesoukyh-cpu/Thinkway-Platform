import type { SupabaseClient } from "@supabase/supabase-js";

import { getCollectionsAnalytics } from "@/lib/analytics/queries/collections";
import { rollupGlobal } from "@/lib/analytics/aggregations/rollup-engine";
import { formatAnalyticsAmount, buildCurrencyContext } from "@/lib/analytics/currency/engine";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { safeLoadAnalyticsFacts } from "@/lib/analytics/queries/load-facts";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import {
  buildAgingSummary,
  groupAgingBy,
  type AgingSummary,
} from "@/lib/collections/aging";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import { invoiceOutstanding } from "@/lib/collections/aging";
import { loadCollectionInvoices } from "@/lib/collections/queries/load-collection-invoices";
import { buildCollectionsAlerts } from "@/lib/collections/alerts/collections-alerts";
import type { CollectionsAlertsPayload } from "@/lib/collections/alerts/collections-alerts";
import { devLog } from "@/lib/platform/logger";

export type CollectionsKpiCard = {
  id: string;
  label: string;
  value: number;
  formatted: string;
  variant?: "default" | "positive" | "negative" | "warning";
  trend_percent?: number | null;
};

export type CollectionsDashboardPayload = {
  kpis: CollectionsKpiCard[];
  aging: AgingSummary;
  aged_invoices: CollectionInvoiceRow[];
  client_aging: ReturnType<typeof groupAgingBy>;
  analytics_aging: Awaited<ReturnType<typeof getCollectionsAnalytics>>["aging"];
  alerts: CollectionsAlertsPayload;
  currency: ReturnType<typeof buildCurrencyContext>;
  collections_this_month: number;
  partial_count: number;
  disputed_count: number;
};

function computeDso(outstanding: number, collectedLast30: number): number {
  if (collectedLast30 <= 0) return 0;
  const daily = collectedLast30 / 30;
  return Math.round(outstanding / daily);
}

export async function loadCollectionsDashboard(
  supabase: SupabaseClient,
  filters: AnalyticsQueryFilters = {}
): Promise<CollectionsDashboardPayload> {
  const [analytics, snapshot, invoices, paymentsMonth] = await Promise.all([
    getCollectionsAnalytics(supabase, filters),
    safeLoadAnalyticsFacts(supabase, filters),
    loadCollectionInvoices(supabase, { limit: 500 }),
    loadCollectionsThisMonth(supabase),
  ]);

  const global = rollupGlobal(snapshot.facts);
  const currencies = snapshot.facts.map((f) => f.currency_code);
  const currency = buildCurrencyContext(currencies);
  const format = (n: number) => formatAnalyticsAmount(n, currency, { decimals: 0 });

  const aging = buildAgingSummary(invoices);
  const aged_invoices = invoices.filter((i) => i.outstanding > 0);
  const client_aging = groupAgingBy(invoices, "client").slice(0, 20);

  const partial_count = invoices.filter((i) => i.collection_status === "partial").length;

  const disputed_count = aged_invoices.filter(
    (i) => i.collection_status === "disputed"
  ).length;

  const badDebtRisk = roundMoney(
    aging.buckets.find((b) => b.bucket === "90_plus")?.amount ?? 0
  );

  const expectedCollections = roundMoney(
    aged_invoices
      .filter((i) => i.aging_bucket === "current" || i.aging_bucket === "1_30")
      .reduce((s, i) => s + i.outstanding, 0)
  );

  const dso = computeDso(aging.total_outstanding, paymentsMonth);

  const kpis: CollectionsKpiCard[] = [
    {
      id: "total_outstanding",
      label: "Total outstanding",
      value: aging.total_outstanding,
      formatted: format(aging.total_outstanding),
      variant: aging.total_outstanding > 0 ? "warning" : "default",
    },
    {
      id: "overdue",
      label: "Overdue amount",
      value: aging.overdue_amount,
      formatted: format(aging.overdue_amount),
      variant: aging.overdue_amount > 0 ? "negative" : "default",
    },
    {
      id: "current_ar",
      label: "Current AR",
      value: aging.current_amount,
      formatted: format(aging.current_amount),
    },
    {
      id: "collections_month",
      label: "Collections this month",
      value: paymentsMonth,
      formatted: format(paymentsMonth),
      variant: "positive",
    },
    {
      id: "expected",
      label: "Expected collections",
      value: expectedCollections,
      formatted: format(expectedCollections),
    },
    {
      id: "dso",
      label: "DSO (days)",
      value: dso,
      formatted: String(dso),
    },
    {
      id: "bad_debt",
      label: "Bad debt risk (90+)",
      value: badDebtRisk,
      formatted: format(badDebtRisk),
      variant: badDebtRisk > 0 ? "negative" : "default",
    },
    {
      id: "partial",
      label: "Partial collections",
      value: partial_count,
      formatted: String(partial_count),
    },
  ];

  const alerts = buildCollectionsAlerts({
    invoices: aged_invoices,
    aging,
    globalOutstanding: global.metrics.outstanding_revenue,
  });

  if (process.env.NODE_ENV === "development") {
    devLog("[collections] dashboard loaded", {
      outstanding: aging.total_outstanding,
      alerts: alerts.alerts.length,
    });
  }

  return {
    kpis,
    aging,
    aged_invoices,
    client_aging,
    analytics_aging: analytics.aging,
    alerts,
    currency,
    collections_this_month: paymentsMonth,
    partial_count,
    disputed_count,
  };
}

async function loadCollectionsThisMonth(supabase: SupabaseClient): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("payments")
    .select("amount")
    .eq("status", "completed")
    .gte("paid_at", start.toISOString());

  if (error) return 0;
  return roundMoney((data ?? []).reduce((s, p) => s + Number((p as { amount: number }).amount), 0));
}
