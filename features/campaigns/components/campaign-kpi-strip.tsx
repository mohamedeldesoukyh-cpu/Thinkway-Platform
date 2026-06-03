"use client";

import {
  AlertTriangleIcon,
  FileTextIcon,
  type LucideIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import {
  PO_STATUS_LABELS,
  PO_STATUS_VARIANT,
} from "@/lib/finance/po/status";
import { cn } from "@/lib/utils";

type CampaignKpiStripProps = {
  workspace: CampaignWorkspace;
  operationalDeliverableCount?: number;
};

type KpiAccent = "blue" | "purple" | "pink" | "green";

type KpiItem = {
  label: string;
  value: string;
  icon: LucideIcon;
  accent: KpiAccent;
  alert?: "warning" | "danger";
};

const ACCENTS: Record<KpiAccent, { tile: string; dot: string }> = {
  blue: { tile: "bg-brand-blue/10 text-brand-blue", dot: "var(--brand-blue)" },
  purple: {
    tile: "bg-brand-purple/10 text-brand-purple",
    dot: "var(--brand-purple)",
  },
  pink: { tile: "bg-brand-pink/10 text-brand-pink", dot: "var(--brand-pink)" },
  green: { tile: "bg-success/10 text-success", dot: "var(--success)" },
};

export function CampaignKpiStrip({
  workspace,
  operationalDeliverableCount,
}: CampaignKpiStripProps) {
  const { financials, lines, deliverables, po } = workspace;
  const currency = workspace.currency_code;
  const assignedLines = lines.filter((l) => l.influencer_id);
  const deliverableKpi =
    operationalDeliverableCount ?? deliverables.length;

  const budgetAlert: KpiItem["alert"] =
    financials.po_exceeded || po.po_status === "exceeded"
      ? "danger"
      : po.po_status === "near_limit"
        ? "warning"
        : undefined;

  const items: KpiItem[] = [
    {
      label: "Budget (PO)",
      value: formatMoney(financials.budget, currency),
      icon: WalletIcon,
      accent: "blue",
      alert: budgetAlert,
    },
    {
      label: "Revenue",
      value: formatMoney(financials.revenue, currency),
      icon: TrendingUpIcon,
      accent: "purple",
    },
    {
      label: "Cost",
      value: formatMoney(financials.cost, currency),
      icon: ReceiptIcon,
      accent: "pink",
    },
    {
      label: "GP",
      value: formatMoney(financials.gp, currency),
      icon: TrendingUpIcon,
      accent: "green",
    },
    {
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      icon: PercentIcon,
      accent: "blue",
    },
    {
      label: "Assignments",
      value: String(assignedLines.length),
      icon: UsersIcon,
      accent: "purple",
    },
    {
      label: "Deliverables",
      value: String(deliverableKpi),
      icon: PackageIcon,
      accent: "pink",
    },
    {
      label: "Outstanding billing",
      value: formatMoney(financials.billing_outstanding, currency),
      icon: FileTextIcon,
      accent: "green",
    },
  ];

  return (
    <div className="sticky top-0 z-10 -mx-1 space-y-2 px-1 pb-2 pt-1 backdrop-blur-sm">
      {(financials.po_exceeded || po.po_status === "near_limit") && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-2xl border px-3 py-2 text-sm",
            financials.po_exceeded
              ? "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
          )}
        >
          {financials.po_exceeded ? (
            <AlertTriangleIcon className="size-4 shrink-0" />
          ) : null}
          <span className="font-medium">
            {financials.po_exceeded
              ? "PO exceeded"
              : "PO near limit"}
          </span>
          <span className="text-muted-foreground">
            {formatMoney(financials.po_consumed, currency)} consumed of{" "}
            {formatMoney(financials.budget, currency)}
            {financials.po_remaining_percent != null
              ? ` · ${formatPercent(financials.po_remaining_percent)} remaining`
              : null}
          </span>
          <Badge variant={PO_STATUS_VARIANT[po.po_status]} className="ml-auto">
            {PO_STATUS_LABELS[po.po_status]}
          </Badge>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {items.map((item) => {
          const hasAlert = item.alert === "danger" || item.alert === "warning";
          const tone = ACCENTS[item.accent];
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={cn(
                "relative shadow-sm",
                item.alert === "danger" &&
                  "border-red-500/50 bg-red-500/5 dark:bg-red-500/10",
                item.alert === "warning" &&
                  "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
              )}
            >
              {!hasAlert ? (
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
                    hasAlert ? "bg-muted text-muted-foreground" : tone.tile
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    "font-heading text-base font-bold tracking-tight",
                    item.alert === "danger" && "text-red-600 dark:text-red-400",
                    item.alert === "warning" &&
                      "text-amber-700 dark:text-amber-300"
                  )}
                >
                  {item.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
