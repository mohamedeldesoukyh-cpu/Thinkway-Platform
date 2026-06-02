import { roundMoney } from "@/lib/analytics/aggregations/round";
import { devLog } from "@/lib/dev-log";
import type { AnalyticsFactsSnapshot } from "@/lib/analytics/queries/load-facts";

export type DashboardTrendPoint = {
  period: string;
  label: string;
  value: number;
};

export type ExecutiveDashboardCharts = {
  revenue_trend: DashboardTrendPoint[];
  gp_trend: DashboardTrendPoint[];
  billing_trend: DashboardTrendPoint[];
  collections_trend: DashboardTrendPoint[];
  po_consumption_trend: DashboardTrendPoint[];
};

function monthKey(dateIso: string): string {
  return dateIso.slice(0, 7);
}

function ensureBucket(
  map: Map<string, DashboardTrendPoint>,
  period: string
): DashboardTrendPoint {
  const existing = map.get(period);
  if (existing) return existing;
  const point = { period, label: period, value: 0 };
  map.set(period, point);
  return point;
}

export function buildExecutiveDashboardCharts(
  snapshot: AnalyticsFactsSnapshot
): ExecutiveDashboardCharts {
  const revenueMap = new Map<string, DashboardTrendPoint>();
  const gpMap = new Map<string, DashboardTrendPoint>();
  const billingMap = new Map<string, DashboardTrendPoint>();
  const collectionsMap = new Map<string, DashboardTrendPoint>();
  const poMap = new Map<string, DashboardTrendPoint>();

  for (const fact of snapshot.facts) {
    const period = fact.period_month ?? "unscheduled";
    const revenueBucket = ensureBucket(revenueMap, period);
    revenueBucket.value = roundMoney(
      revenueBucket.value + fact.metrics.revenue
    );
    const gpBucket = ensureBucket(gpMap, period);
    gpBucket.value = roundMoney(gpBucket.value + fact.metrics.gp);
    const poBucket = ensureBucket(poMap, period);
    poBucket.value = roundMoney(
      poBucket.value + fact.metrics.actual_amount
    );
  }

  for (const inv of snapshot.invoices) {
    if (!inv.issue_date) continue;
    const period = monthKey(inv.issue_date);
    const billingBucket = ensureBucket(billingMap, period);
    billingBucket.value = roundMoney(
      billingBucket.value + Number(inv.total)
    );
    const collectionsBucket = ensureBucket(collectionsMap, period);
    collectionsBucket.value = roundMoney(
      collectionsBucket.value + Number(inv.amount_paid)
    );
  }

  const sortPoints = (map: Map<string, DashboardTrendPoint>) =>
    [...map.values()].sort((a, b) => a.period.localeCompare(b.period));

  const revenue_trend = sortPoints(revenueMap);
  const gp_trend = sortPoints(gpMap);
  const billing_trend = sortPoints(billingMap);
  const collections_trend = sortPoints(collectionsMap);
  const po_consumption_trend = sortPoints(poMap);

  if (process.env.NODE_ENV === "development") {
    devLog("[dashboard-chart] built executive chart series", {
      billingPoints: billing_trend.length,
      collectionsPoints: collections_trend.length,
    });
  }

  return {
    revenue_trend,
    gp_trend,
    billing_trend,
    collections_trend,
    po_consumption_trend,
  };
}
