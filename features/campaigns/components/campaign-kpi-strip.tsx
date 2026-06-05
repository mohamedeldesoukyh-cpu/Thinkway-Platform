"use client";

import {
  FileTextIcon,
  type LucideIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PoConsumptionBanner } from "@/components/finance/po-consumption-banner";
import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";

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
  const { financials, lines, deliverables } = workspace;
  const currency = workspace.currency_code;
  const assignedLines = lines;
  const deliverableKpi =
    operationalDeliverableCount ?? deliverables.length;

  const budgetAlert =
    financials.po_exceeded
      ? "danger"
      : workspace.po.po_status === "near_limit"
        ? "warning"
        : undefined;

  const items = [
    {
      id: "budget",
      label: "Budget (PO)",
      value: formatMoney(financials.budget, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.blue,
      valueAlert: budgetAlert,
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
    valueAlert?: "warning" | "danger";
  }[];

  return (
    <div className="space-y-3 pb-8">
      {financials.budget > 0 ? (
        <div className="flex w-full justify-end">
          <PoConsumptionBanner
            consumed={financials.po_consumed}
            po_amount={financials.budget}
            currency={currency}
            formatMoney={formatMoney}
            po_exceeded={financials.po_exceeded}
            className="w-fit max-w-full"
          />
        </div>
      ) : null}

      <KpiCarousel items={items} showNavigation={false} />
    </div>
  );
}
