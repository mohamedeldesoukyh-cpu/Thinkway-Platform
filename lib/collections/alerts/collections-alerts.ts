import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { AgingSummary } from "@/lib/collections/aging";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import { devLog } from "@/lib/platform/logger";

export type CollectionsAlertSeverity = "info" | "warning" | "danger";

export type CollectionsAlert = {
  id: string;
  severity: CollectionsAlertSeverity;
  group: "overdue" | "risk" | "dispute" | "balance" | "cashflow";
  title: string;
  description: string;
  href: string;
  amount?: number;
};

export type CollectionsAlertsPayload = {
  alerts: CollectionsAlert[];
};

const LARGE_BALANCE_THRESHOLD = 50_000;

export function buildCollectionsAlerts(input: {
  invoices: CollectionInvoiceRow[];
  aging: AgingSummary;
  globalOutstanding: number;
}): CollectionsAlertsPayload {
  const alerts: CollectionsAlert[] = [];

  if (input.aging.overdue_amount > 0) {
    alerts.push({
      id: "overdue-total",
      severity: input.aging.overdue_amount > 100_000 ? "danger" : "warning",
      group: "overdue",
      title: "Overdue receivables",
      description: `${input.aging.invoice_count} open invoice(s) with past-due balances.`,
      href: "/collections?tab=overdue",
      amount: input.aging.overdue_amount,
    });
  }

  const bucket90 = input.aging.buckets.find((b) => b.bucket === "90_plus");
  if (bucket90 && bucket90.amount > 0) {
    alerts.push({
      id: "aging-escalation",
      severity: "danger",
      group: "risk",
      title: "Aging escalation (90+)",
      description: `${bucket90.count} invoice(s) in 90+ day bucket.`,
      href: "/collections?tab=aging",
      amount: bucket90.amount,
    });
  }

  for (const inv of input.invoices) {
    if (inv.collection_status === "disputed") {
      alerts.push({
        id: `dispute-${inv.id}`,
        severity: "warning",
        group: "dispute",
        title: "Disputed invoice",
        description: `${inv.document_number ?? inv.id} is flagged disputed.`,
        href: `/billing/invoices/${inv.id}`,
        amount: inv.outstanding,
      });
    }
    if (inv.outstanding >= LARGE_BALANCE_THRESHOLD) {
      alerts.push({
        id: `large-${inv.id}`,
        severity: "warning",
        group: "balance",
        title: "Large open balance",
        description: `${inv.client_name ?? "Client"} — ${inv.document_number ?? inv.id}`,
        href: `/billing/invoices/${inv.id}`,
        amount: inv.outstanding,
      });
    }
  }

  const byClient = new Map<string, { name: string; total: number }>();
  for (const inv of input.invoices) {
    const cur = byClient.get(inv.client_id) ?? {
      name: inv.client_name ?? inv.client_id,
      total: 0,
    };
    cur.total = roundMoney(cur.total + inv.outstanding);
    byClient.set(inv.client_id, cur);
  }

  for (const [clientId, { name, total }] of byClient) {
    if (total >= LARGE_BALANCE_THRESHOLD * 2) {
      alerts.push({
        id: `client-risk-${clientId}`,
        severity: "danger",
        group: "risk",
        title: "High-risk client exposure",
        description: `${name} has elevated aggregate AR.`,
        href: `/collections?tab=statements&client=${clientId}`,
        amount: total,
      });
    }
  }

  if (input.globalOutstanding > 0 && input.aging.overdue_amount / input.globalOutstanding > 0.4) {
    alerts.push({
      id: "cashflow-risk",
      severity: "danger",
      group: "cashflow",
      title: "Cashflow risk",
      description: "Over 40% of outstanding AR is past due.",
      href: "/treasury",
      amount: input.aging.overdue_amount,
    });
  }

  const sorted = alerts
    .sort((a, b) => {
      const rank = { danger: 0, warning: 1, info: 2 };
      return rank[a.severity] - rank[b.severity];
    })
    .slice(0, 25);

  if (process.env.NODE_ENV === "development") {
    devLog("[collections] alerts built", { count: sorted.length });
  }

  return { alerts: sorted };
}
