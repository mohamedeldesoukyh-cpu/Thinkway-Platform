"use client";

import {
  AlertTriangleIcon,
  BanknoteIcon,
  CoinsIcon,
  FileTextIcon,
  type LucideIcon,
  PercentIcon,
  PiggyBankIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { BillingKpiSummary } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";

type BillingKpiStripProps = {
  kpis: BillingKpiSummary;
  currency?: string;
  mixedCurrency?: boolean;
};

type KpiAccent = "blue" | "purple" | "pink" | "green";

const ACCENT_TILE: Record<KpiAccent, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
};

const KPI_ITEMS: {
  key:
    | "revenue"
    | "cost"
    | "gp"
    | "margin"
    | "billed"
    | "collected"
    | "outstanding"
    | "unpaid_vendor"
    | "po_remaining";
  label: string;
  icon: LucideIcon;
  accent: KpiAccent;
}[] = [
  { key: "revenue", label: "Revenue", icon: TrendingUpIcon, accent: "blue" },
  { key: "cost", label: "Cost", icon: ReceiptIcon, accent: "purple" },
  { key: "gp", label: "Gross profit", icon: PiggyBankIcon, accent: "pink" },
  { key: "margin", label: "Margin", icon: PercentIcon, accent: "green" },
  { key: "billed", label: "Billed revenue", icon: FileTextIcon, accent: "blue" },
  { key: "collected", label: "Collected", icon: BanknoteIcon, accent: "purple" },
  {
    key: "outstanding",
    label: "Outstanding invoices",
    icon: CoinsIcon,
    accent: "pink",
  },
  {
    key: "unpaid_vendor",
    label: "Unpaid vendor cost",
    icon: WalletIcon,
    accent: "green",
  },
  { key: "po_remaining", label: "PO remaining", icon: CoinsIcon, accent: "blue" },
];

export function BillingKpiStrip({
  kpis,
  currency,
  mixedCurrency = false,
}: BillingKpiStripProps) {
  const formatKpiAmount = (amount: number) => {
    if (mixedCurrency || !currency) {
      return new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return formatBillingMoney(amount, currency);
  };

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
    accentClass: ACCENT_TILE[item.accent],
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
    <div className="space-y-2">
      {mixedCurrency ? (
        <p className="text-[11px] text-muted-foreground">
          KPI totals combine multiple currencies — row-level amounts use each campaign&apos;s
          currency.
        </p>
      ) : null}
      {kpis.po_over_consumed_count > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border-2 border-red-500/70 bg-red-500/10 px-3 py-2 text-[11px] text-red-950 dark:text-red-50">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {kpis.po_over_consumed_count} campaign
          {kpis.po_over_consumed_count === 1 ? "" : "s"} exceed approved PO.
        </div>
      ) : null}
      <KpiCarousel items={items} showNavigation={false} />
    </div>
  );
}
