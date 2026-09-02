"use client";

import { AlertTriangleIcon } from "lucide-react";

import type { BillingKpiSummary } from "@/features/billing/types";
import { formatBillingMoneyCompact } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";
import { formatKpiCurrency } from "@/components/shared/kpi/kpi-utils";
import { cn } from "@/lib/utils";

type BillingKpiStripProps = {
  kpis: BillingKpiSummary;
  currency?: string;
  mixedCurrency?: boolean;
  campaignCount?: number;
  billedCampaignCount?: number;
  remainingToInvoice?: number;
};

export function BillingKpiStrip({
  kpis,
  currency,
  mixedCurrency = false,
  campaignCount = 0,
  billedCampaignCount = 0,
  remainingToInvoice,
}: BillingKpiStripProps) {
  const formatKpiAmount = (amount: number) =>
    mixedCurrency || !currency
      ? formatKpiCurrency(amount, null, { mixed: true })
      : formatBillingMoneyCompact(amount, currency);

  const toInvoice =
    remainingToInvoice ?? Math.max(0, kpis.revenue - kpis.billed_revenue);
  const collectedLooksHigh =
    kpis.billed_revenue > 0 && kpis.collected_revenue > kpis.billed_revenue * 1.5;

  const hero = [
    {
      id: "revenue",
      label: "Revenue",
      value: formatKpiAmount(kpis.revenue),
      hint:
        campaignCount > 0
          ? `${campaignCount} campaign${campaignCount === 1 ? "" : "s"}`
          : "Campaign revenue",
      bad: false,
    },
    {
      id: "billed",
      label: "Billed",
      value: formatKpiAmount(kpis.billed_revenue),
      hint:
        campaignCount > 0
          ? `${billedCampaignCount} of ${campaignCount} campaigns`
          : "Issued invoice total",
      bad: false,
    },
    {
      id: "to_invoice",
      label: "To invoice",
      value: formatKpiAmount(toInvoice),
      hint: "achieved but not billed",
      bad: false,
    },
    {
      id: "collected",
      label: "Collected",
      value: formatKpiAmount(kpis.collected_revenue),
      hint: `${formatKpiAmount(kpis.outstanding_invoices)} outstanding`,
      bad: collectedLooksHigh,
    },
  ] as const;

  const secondary = [
    { id: "cost", label: "Cost", value: formatKpiAmount(kpis.cost), bad: false },
    { id: "gp", label: "Gross profit", value: formatKpiAmount(kpis.gp), bad: false },
    { id: "margin", label: "Margin", value: formatPercent(kpis.margin_percent), bad: false },
    {
      id: "unpaid_vendor",
      label: "Unpaid vendor",
      value: formatKpiAmount(kpis.unpaid_vendor_cost),
      bad: kpis.unpaid_vendor_cost > 0 && kpis.unpaid_vendor_cost >= kpis.cost - 0.01,
    },
    {
      id: "po_remaining",
      label: "PO remaining",
      value: formatKpiAmount(kpis.po_remaining),
      bad: kpis.po_over_consumed_count > 0,
    },
  ] as const;

  return (
    <div className="space-y-2">
      <div className="bq-kwrap">
        {hero.map((item) => (
          <div key={item.id} className={cn("bq-k", item.bad && "bad")}>
            <div className="bq-k__l">{item.label}</div>
            <div className="bq-k__v bq-n">{item.value}</div>
            <div className="bq-k__s">{item.hint}</div>
          </div>
        ))}
      </div>
      <div className="bq-k2">
        {secondary.map((item) => (
          <div key={item.id} className="bq-m">
            <i>{item.label}</i>
            <b className={cn("bq-n", item.bad && "bad")}>{item.value}</b>
          </div>
        ))}
      </div>
      {mixedCurrency ? (
        <p className="text-[11px] text-muted-foreground">
          KPI totals combine multiple currencies — row-level amounts use each campaign&apos;s
          currency.
        </p>
      ) : null}
      {kpis.po_over_consumed_count > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {kpis.po_over_consumed_count} campaign
          {kpis.po_over_consumed_count === 1 ? "" : "s"} exceed approved PO.
        </div>
      ) : null}
    </div>
  );
}
