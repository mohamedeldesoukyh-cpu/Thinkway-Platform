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
import { KpiCarousel } from "@/components/ui/kpi-carousel";
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

const ACCENT_TILE: Record<KpiAccent, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
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

  const budgetAlert =
    financials.po_exceeded || po.po_status === "exceeded"
      ? "danger"
      : po.po_status === "near_limit"
        ? "warning"
        : undefined;

  const items = [
    {
      id: "budget",
      label: "Budget (PO)",
      value: formatMoney(financials.budget, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.blue,
      alert: budgetAlert,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(financials.revenue, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "cost",
      label: "Cost",
      value: formatMoney(financials.cost, currency),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.pink,
    },
    {
      id: "gp",
      label: "GP",
      value: formatMoney(financials.gp, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.green,
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      icon: PercentIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "assignments",
      label: "Assignments",
      value: String(assignedLines.length),
      icon: UsersIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "deliverables",
      label: "Deliverables",
      value: String(deliverableKpi),
      icon: PackageIcon,
      accentClass: ACCENT_TILE.pink,
    },
    {
      id: "billing",
      label: "Outstanding billing",
      value: formatMoney(financials.billing_outstanding, currency),
      icon: FileTextIcon,
      accentClass: ACCENT_TILE.green,
    },
  ] satisfies {
    id: string;
    label: string;
    value: string;
    icon: LucideIcon;
    accentClass: string;
    alert?: "warning" | "danger";
  }[];

  return (
    <div className="space-y-2">
      {(financials.po_exceeded || po.po_status === "near_limit") && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-sm",
            financials.po_exceeded
              ? "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200"
              : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100"
          )}
        >
          {financials.po_exceeded ? (
            <AlertTriangleIcon className="size-4 shrink-0" />
          ) : null}
          <span className="font-medium">
            {financials.po_exceeded ? "PO exceeded" : "PO near limit"}
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

      <KpiCarousel items={items} />
    </div>
  );
}
