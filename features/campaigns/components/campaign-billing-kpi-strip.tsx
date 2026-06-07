"use client";

import {
  FileTextIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";
import { sumIoGatedAssignmentBillable } from "@/lib/billing/queue-eligibility";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

type CampaignBillingKpiStripProps = {
  workspace: CampaignWorkspace;
  /** When set, revenue / PO consumed reflect Vendor-IO-gated billable only. */
  operationalRows?: OperationalBillingRow[];
};

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const;

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

  const items = [
    {
      id: "po-total",
      label: "PO total",
      value: formatMoney(financials.po_total, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.blue,
      alert: poAlert,
    },
    {
      id: "po-consumed",
      label: "PO consumed",
      value: formatMoney(billingPoConsumed, currency),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.pink,
      alert: poAlert,
    },
    {
      id: "remaining-po",
      label: "Remaining PO",
      value: formatMoney(billingRemainingPo, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.amber,
      alert: poAlert,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(billingRevenue, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "collected",
      label: "Collected",
      value: formatMoney(financials.collected, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.green,
    },
    {
      id: "outstanding",
      label: "Outstanding",
      value: formatMoney(financials.billing_outstanding, currency),
      icon: FileTextIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent ?? 0),
      icon: PercentIcon,
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

  return <KpiCarousel items={items} />;
}
