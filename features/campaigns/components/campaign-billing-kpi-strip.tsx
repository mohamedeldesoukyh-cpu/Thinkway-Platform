"use client";

import {
  FileTextIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

import { PoConsumptionBanner } from "@/components/finance/po-consumption-banner";
import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { formatMoney, formatPercent } from "@/features/campaigns/utils";

type CampaignBillingKpiStripProps = {
  workspace: CampaignWorkspace;
};

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const;

export function CampaignBillingKpiStrip({ workspace }: CampaignBillingKpiStripProps) {
  const { financials } = workspace;
  const currency = workspace.currency_code;

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
      value: formatMoney(financials.po_consumed, currency),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.pink,
      alert: poAlert,
    },
    {
      id: "remaining-po",
      label: "Remaining PO",
      value: formatMoney(financials.remaining_po, currency),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.amber,
      alert: poAlert,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(financials.revenue, currency),
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

  return (
    <div className="space-y-2">
      {financials.po_total > 0 ? (
        <PoConsumptionBanner
          consumed={financials.po_consumed}
          po_amount={financials.po_total}
          currency={currency}
          formatMoney={formatMoney}
          po_exceeded={financials.po_exceeded}
        />
      ) : null}
      <KpiCarousel items={items} />
    </div>
  );
}
