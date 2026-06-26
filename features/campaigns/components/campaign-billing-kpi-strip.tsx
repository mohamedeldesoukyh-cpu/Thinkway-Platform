"use client";

import {
  FileTextIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { sumIoGatedAssignmentBillable } from "@/lib/billing/queue-eligibility";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

type CampaignBillingKpiStripProps = {
  workspace: CampaignWorkspace;
  /** When set, revenue / PO consumed reflect Vendor-IO-gated billable only. */
  operationalRows?: OperationalBillingRow[];
};

export function CampaignBillingKpiStrip({
  workspace,
  operationalRows,
}: CampaignBillingKpiStripProps) {
  const { financials } = workspace;
  const currency = workspace.currency_code;

  const ioGatedBillable =
    operationalRows && operationalRows.length > 0
      ? sumIoGatedAssignmentBillable(operationalRows)
      : null;
  const billingRevenue = ioGatedBillable ?? financials.revenue;
  const billingPoConsumed = ioGatedBillable ?? financials.po_consumed;
  const billingRemainingPo = financials.po_total - billingPoConsumed;

  const poAlert =
    financials.po_exceeded || workspace.po.po_status === "exceeded"
      ? ("danger" as const)
      : workspace.po.po_status === "near_limit"
        ? ("warning" as const)
        : undefined;

  const items: KpiCarouselItem[] = [
    {
      id: "po-total",
      label: "PO total",
      value: formatMoney(financials.po_total, currency),
      icon: WalletIcon,
      accentKey: "blue",
      alert: poAlert,
    },
    {
      id: "po-consumed",
      label: "PO consumed",
      value: formatMoney(billingPoConsumed, currency),
      icon: ReceiptIcon,
      accentKey: "pink",
      alert: poAlert,
    },
    {
      id: "remaining-po",
      label: "Remaining PO",
      value: formatMoney(billingRemainingPo, currency),
      icon: WalletIcon,
      accentKey: "amber",
      alert: poAlert,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(billingRevenue, currency),
      icon: TrendingUpIcon,
      accentKey: "purple",
    },
    {
      id: "collected",
      label: "Collected",
      value: formatMoney(financials.collected, currency),
      icon: TrendingUpIcon,
      accentKey: "green",
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: formatMoney(financials.billing_outstanding, currency),
      icon: FileTextIcon,
      accentKey: "blue",
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent ?? 0),
      icon: PercentIcon,
      accentKey: "green",
    },
  ];

  return <KpiStrip items={items} />;
}
