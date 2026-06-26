"use client";

import {
  FileTextIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { PoConsumptionBanner } from "@/components/finance/po-consumption-banner";
import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";

type CampaignKpiStripProps = {
  workspace: CampaignWorkspace;
  operationalDeliverableCount?: number;
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

  const items: KpiCarouselItem[] = [
    {
      id: "budget",
      label: "Budget (PO)",
      value: formatMoney(financials.budget, currency),
      icon: WalletIcon,
      accentKey: "blue",
      valueAlert: budgetAlert,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(financials.revenue, currency),
      icon: TrendingUpIcon,
      accentKey: "purple",
      valueSemantic: "revenue",
    },
    {
      id: "cost",
      label: "Cost",
      value: formatMoney(financials.cost, currency),
      icon: ReceiptIcon,
      accentKey: "pink",
      valueSemantic: "cost",
    },
    {
      id: "gp",
      label: "GP",
      value: formatMoney(financials.gp, currency),
      icon: TrendingUpIcon,
      accentKey: "green",
      valueSemantic: "gp",
      valueNumeric: financials.gp,
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      icon: PercentIcon,
      accentKey: "blue",
      valueSemantic: "margin",
      valueNumeric: financials.margin_percent,
    },
    {
      id: "assignments",
      label: "Assignments",
      value: String(assignedLines.length),
      icon: UsersIcon,
      accentKey: "purple",
      valueSemantic: "count",
    },
    {
      id: "deliverables",
      label: "Deliverables",
      value: String(deliverableKpi),
      icon: PackageIcon,
      accentKey: "pink",
      valueSemantic: "count",
    },
    {
      id: "billing",
      label: "Outstanding billing",
      value: formatMoney(financials.billing_outstanding, currency),
      icon: FileTextIcon,
      accentKey: "green",
      valueSemantic: "revenue",
    },
  ];

  return (
    <div className="space-y-3 pb-8">
      {financials.budget > 0 ? (
        <div className="flex w-full justify-end">
          <PoConsumptionBanner
            consumed={financials.po_banner_consumed}
            po_amount={financials.budget}
            currency={currency}
            formatMoney={formatMoney}
            po_exceeded={financials.po_exceeded}
            className="w-fit max-w-full"
          />
        </div>
      ) : null}

      <KpiStrip items={items} showNavigation={false} />
    </div>
  );
}
