"use client";

import { AlertTriangleIcon } from "lucide-react";

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
};

type KpiItem = {
  label: string;
  value: string;
  alert?: "warning" | "danger";
};

export function CampaignKpiStrip({ workspace }: CampaignKpiStripProps) {
  const { financials, lines, deliverables, po } = workspace;
  const currency = workspace.currency_code;
  const assignedLines = lines.filter((l) => l.influencer_id);

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
      alert: budgetAlert,
    },
    { label: "Revenue", value: formatMoney(financials.revenue, currency) },
    { label: "Cost", value: formatMoney(financials.cost, currency) },
    { label: "GP", value: formatMoney(financials.gp, currency) },
    { label: "Margin", value: formatPercent(financials.margin_percent) },
    { label: "Assignments", value: String(assignedLines.length) },
    { label: "Deliverables", value: String(deliverables.length) },
    {
      label: "Outstanding billing",
      value: formatMoney(financials.billing_outstanding, currency),
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
        {items.map((item) => (
          <Card
            key={item.label}
            className={cn(
              "shadow-sm",
              item.alert === "danger" &&
                "border-red-500/50 bg-red-500/5 dark:bg-red-500/10",
              item.alert === "warning" &&
                "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10"
            )}
          >
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p
                className={cn(
                  "font-heading text-base font-semibold tracking-tight",
                  item.alert === "danger" && "text-red-600 dark:text-red-400",
                  item.alert === "warning" && "text-amber-700 dark:text-amber-300"
                )}
              >
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
