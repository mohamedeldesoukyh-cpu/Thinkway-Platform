"use client";

import {
  AlertTriangleIcon,
  BanknoteIcon,
  CoinsIcon,
  FileTextIcon,
  PercentIcon,
  PiggyBankIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { KPI_ACCENT_CLASS } from "@/components/shared/kpi/kpi-config";
import { KpiStrip } from "@/components/shared/kpi/kpi-strip";
import type { BillingKpiSummary } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";
import { formatKpiCurrency } from "@/components/shared/kpi/kpi-utils";

type BillingKpiStripProps = {
  kpis: BillingKpiSummary;
  currency?: string;
  mixedCurrency?: boolean;
};

const KPI_ITEMS = [
  { key: "revenue" as const, label: "Revenue", icon: TrendingUpIcon, accentKey: "blue" as const },
  { key: "cost" as const, label: "Cost", icon: ReceiptIcon, accentKey: "purple" as const },
  { key: "gp" as const, label: "Gross profit", icon: PiggyBankIcon, accentKey: "pink" as const },
  { key: "margin" as const, label: "Margin", icon: PercentIcon, accentKey: "green" as const },
  { key: "billed" as const, label: "Billed revenue", icon: FileTextIcon, accentKey: "blue" as const },
  { key: "collected" as const, label: "Collected", icon: BanknoteIcon, accentKey: "purple" as const },
  { key: "outstanding" as const, label: "Outstanding invoices", icon: CoinsIcon, accentKey: "pink" as const },
  { key: "unpaid_vendor" as const, label: "Unpaid vendor cost", icon: WalletIcon, accentKey: "green" as const },
  { key: "po_remaining" as const, label: "PO remaining", icon: CoinsIcon, accentKey: "blue" as const },
];

export function BillingKpiStrip({
  kpis,
  currency,
  mixedCurrency = false,
}: BillingKpiStripProps) {
  const formatKpiAmount = (amount: number) =>
    mixedCurrency || !currency
      ? formatKpiCurrency(amount, null, { mixed: true })
      : formatBillingMoney(amount, currency);

  const values: Record<(typeof KPI_ITEMS)[number]["key"], string> = {
    revenue: formatKpiAmount(kpis.revenue),
    cost: formatKpiAmount(kpis.cost),
    gp: formatKpiAmount(kpis.gp),
    margin: formatPercent(kpis.margin_percent),
    billed: formatKpiAmount(kpis.billed_revenue),
    collected: formatKpiAmount(kpis.collected_revenue),
    outstanding: formatKpiAmount(kpis.outstanding_invoices),
    unpaid_vendor: formatKpiAmount(kpis.unpaid_vendor_cost),
    po_remaining: formatKpiAmount(kpis.po_remaining),
  };

  const items = KPI_ITEMS.map((item) => ({
    id: item.key,
    label: item.label,
    value: values[item.key],
    icon: item.icon,
    accentClass: KPI_ACCENT_CLASS[item.accentKey],
    valueSemantic:
      item.key === "revenue" || item.key === "billed" || item.key === "collected"
        ? ("revenue" as const)
        : item.key === "cost" || item.key === "unpaid_vendor"
          ? ("cost" as const)
          : item.key === "gp"
            ? ("gp" as const)
            : item.key === "margin"
              ? ("margin" as const)
              : undefined,
    valueNumeric:
      item.key === "gp"
        ? kpis.gp
        : item.key === "margin"
          ? kpis.margin_percent
          : undefined,
    valueAlert:
      item.key === "po_remaining" && kpis.po_over_consumed_count > 0
        ? ("danger" as const)
        : undefined,
  }));

  return (
    <KpiStrip
      items={items}
      showNavigation={false}
      mixedCurrencyNotice={
        mixedCurrency
          ? "KPI totals combine multiple currencies — row-level amounts use each campaign's currency."
          : undefined
      }
    >
      {kpis.po_over_consumed_count > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border-2 border-destructive/70 bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {kpis.po_over_consumed_count} campaign
          {kpis.po_over_consumed_count === 1 ? "" : "s"} exceed approved PO.
        </div>
      ) : null}
    </KpiStrip>
  );
}
