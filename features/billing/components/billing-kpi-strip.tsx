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

import { Card, CardContent } from "@/components/ui/card";
import type { BillingKpiSummary } from "@/features/billing/types";
import { formatBillingMoney } from "@/features/billing/utils";
import { formatPercent } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type BillingKpiStripProps = {
  kpis: BillingKpiSummary;
  currency?: string;
  mixedCurrency?: boolean;
};

type KpiAccent = "blue" | "purple" | "pink" | "green";

const ACCENTS: Record<KpiAccent, { tile: string; dot: string }> = {
  blue: { tile: "bg-brand-blue/10 text-brand-blue", dot: "var(--brand-blue)" },
  purple: {
    tile: "bg-brand-purple/10 text-brand-purple",
    dot: "var(--brand-purple)",
  },
  pink: { tile: "bg-brand-pink/10 text-brand-pink", dot: "var(--brand-pink)" },
  green: { tile: "bg-success/10 text-success", dot: "var(--success)" },
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

  return (
    <div className="space-y-2">
      {mixedCurrency ? (
        <p className="text-xs text-muted-foreground">
          KPI totals combine multiple currencies — row-level amounts use each campaign&apos;s currency.
        </p>
      ) : null}
      {kpis.po_over_consumed_count > 0 ? (
        <div className="flex items-center gap-2 rounded-3xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-800 dark:text-red-200">
          <AlertTriangleIcon className="size-4 shrink-0" />
          {kpis.po_over_consumed_count} campaign
          {kpis.po_over_consumed_count === 1 ? "" : "s"} exceed approved PO — finance review required.
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KPI_ITEMS.map((item) => {
          const alert =
            item.key === "po_remaining" && kpis.po_over_consumed_count > 0;
          const tone = ACCENTS[item.accent];
          const Icon = item.icon;
          return (
            <Card
              key={item.key}
              className={cn(
                "relative shadow-sm",
                alert && "border-red-500/50 bg-red-500/5 dark:bg-red-500/10"
              )}
            >
              {!alert ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-5 -right-5 size-16 rounded-full opacity-[0.07]"
                  style={{ backgroundColor: tone.dot }}
                />
              ) : null}
              <CardContent className="relative p-3">
                <div
                  className={cn(
                    "mb-2 flex size-8 items-center justify-center rounded-xl",
                    alert ? "bg-muted text-muted-foreground" : tone.tile
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    "font-heading text-lg font-bold tracking-tight",
                    alert && "text-red-600 dark:text-red-400"
                  )}
                >
                  {values[item.key]}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
