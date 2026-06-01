"use client";

import { AlertTriangleIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { BillingKpiSummary } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";

type BillingKpiStripProps = {
  kpis: BillingKpiSummary;
  currency?: string;
};

const KPI_ITEMS = [
  { key: "revenue", label: "Revenue" },
  { key: "cost", label: "Cost" },
  { key: "gp", label: "Gross profit" },
  { key: "margin", label: "Margin" },
  { key: "billed", label: "Billed revenue" },
  { key: "collected", label: "Collected" },
  { key: "outstanding", label: "Outstanding invoices" },
  { key: "unpaid_vendor", label: "Unpaid vendor cost" },
  { key: "po_remaining", label: "PO remaining" },
] as const;

export function BillingKpiStrip({ kpis, currency = "USD" }: BillingKpiStripProps) {
  const values: Record<(typeof KPI_ITEMS)[number]["key"], string> = {
    revenue: formatBillingMoney(kpis.revenue, currency),
    cost: formatBillingMoney(kpis.cost, currency),
    gp: formatBillingMoney(kpis.gp, currency),
    margin: formatPercent(kpis.margin_percent),
    billed: formatBillingMoney(kpis.billed_revenue, currency),
    collected: formatBillingMoney(kpis.collected_revenue, currency),
    outstanding: formatBillingMoney(kpis.outstanding_invoices, currency),
    unpaid_vendor: formatBillingMoney(kpis.unpaid_vendor_cost, currency),
    po_remaining: formatBillingMoney(kpis.po_remaining, currency),
  };

  return (
    <div className="space-y-2">
      {kpis.po_over_consumed_count > 0 ? (
        <div className="flex items-center gap-2 rounded-3xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {kpis.po_over_consumed_count} campaign line
          {kpis.po_over_consumed_count === 1 ? "" : "s"} exceed PO allocation — finance review required.
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KPI_ITEMS.map((item) => (
          <Card key={item.key} className="shadow-sm">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-heading text-lg font-semibold tracking-tight">
                {values[item.key]}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
