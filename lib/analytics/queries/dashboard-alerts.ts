import { isUuid } from "@/lib/validation/uuid";
import { rollupFacts } from "@/lib/analytics/aggregations/rollup-engine";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { devLog } from "@/lib/dev-log";
import type { AnalyticsQueryFilters } from "@/lib/analytics/types/filters";
import type { AnalyticsFactsSnapshot } from "@/lib/analytics/queries/load-facts";
import type { CollectionsAnalyticsOutput } from "@/lib/analytics/types/outputs";

export type FinanceAlertSeverity = "info" | "warning" | "danger";

export type FinanceAlert = {
  id: string;
  severity: FinanceAlertSeverity;
  group: "po" | "collections" | "billing" | "profitability" | "vendor";
  title: string;
  description: string;
  href: string;
  amount?: number;
};

export type FinanceAlertsPayload = {
  alerts: FinanceAlert[];
  by_group: Record<FinanceAlert["group"], FinanceAlert[]>;
};

const LOW_MARGIN_THRESHOLD = 12;
const PO_NEAR_LIMIT_RATIO = 0.85;

export function buildFinanceAlerts(input: {
  snapshot: AnalyticsFactsSnapshot;
  collections: CollectionsAnalyticsOutput;
  filters?: AnalyticsQueryFilters;
}): FinanceAlertsPayload {
  const alerts: FinanceAlert[] = [];
  const campaigns = rollupFacts(input.snapshot.facts, "campaign", input.filters);

  for (const node of campaigns) {
    const m = node.metrics;
    const budget = m.budget_amount;
    const consumed = m.actual_amount;

    if (budget > 0 && consumed / budget >= PO_NEAR_LIMIT_RATIO && consumed <= budget) {
      alerts.push({
        id: `po-near-${node.key}`,
        severity: "warning",
        group: "po",
        title: "PO consumed",
        description: `${node.label}: ${Math.round((consumed / budget) * 100)}% of approved PO consumed.`,
        href: `/finance/po-tracker`,
        amount: roundMoney(budget - consumed),
      });
    }

    if (budget > 0 && consumed > budget) {
      alerts.push({
        id: `po-over-${node.key}`,
        severity: "danger",
        group: "po",
        title: "PO exceeded",
        description: `${node.label} is over the approved PO envelope.`,
        href: `/finance/po-tracker`,
        amount: roundMoney(consumed - budget),
      });
    }

    if (m.remaining_to_invoice > 0 && m.achieved_revenue > 0) {
      alerts.push({
        id: `unbilled-${node.key}`,
        severity: "warning",
        group: "billing",
        title: "Unbilled achieved revenue",
        description: `${node.label} has achieved revenue pending invoice.`,
        href: `/billing`,
        amount: m.remaining_to_invoice,
      });
    }

    if (m.revenue > 0 && m.margin_percent < LOW_MARGIN_THRESHOLD) {
      alerts.push({
        id: `margin-${node.key}`,
        severity: m.margin_percent < 5 ? "danger" : "warning",
        group: "profitability",
        title: "Low margin campaign",
        description: `${node.label} margin is ${m.margin_percent.toFixed(1)}%.`,
        href: isUuid(node.key) ? `/campaigns/${node.key}` : "/campaigns",
        amount: m.gp,
      });
    }

    if (m.vendor_payable > 0) {
      alerts.push({
        id: `vendor-${node.key}`,
        severity: "warning",
        group: "vendor",
        title: "Vendor payment exposure",
        description: `${node.label} has unpaid vendor obligations.`,
        href: `/vendors`,
        amount: m.vendor_payable,
      });
    }
  }

  for (const row of input.collections.aging) {
    if (row.bucket === "61_90" || row.bucket === "90_plus") {
      if (row.count > 0) {
        alerts.push({
          id: `aging-${row.bucket}`,
          severity: row.bucket === "90_plus" ? "danger" : "warning",
          group: "collections",
          title: "Overdue invoices",
          description: `${row.count} invoice(s) in ${row.label} — ${row.amount.toLocaleString()} outstanding.`,
          href: "/billing",
          amount: row.amount,
        });
      }
    }
  }

  const by_group: FinanceAlertsPayload["by_group"] = {
    po: [],
    collections: [],
    billing: [],
    profitability: [],
    vendor: [],
  };

  for (const alert of alerts) {
    by_group[alert.group].push(alert);
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[dashboard-alerts] finance alerts computed", {
      total: alerts.length,
    });
  }

  return { alerts, by_group };
}
