"use client";

import {
  FileTextIcon,
  LayersIcon,
  MegaphoneIcon,
  PercentIcon,
  Share2Icon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";

type VendorKpiStripProps = {
  workspace: VendorWorkspace;
};

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
} as const;

export function VendorKpiStrip({ workspace }: VendorKpiStripProps) {
  const { counts, financials } = workspace;
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  const items = [
    {
      id: "assignments",
      label: "Assignments",
      value: String(counts.assignments),
      icon: UsersIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "campaigns",
      label: "Campaigns",
      value: String(counts.campaigns),
      icon: MegaphoneIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "deliverables",
      label: "Deliverables",
      value: String(counts.deliverables),
      icon: LayersIcon,
      accentClass: ACCENT_TILE.pink,
    },
    {
      id: "platforms",
      label: "Platforms",
      value: String(counts.platforms),
      icon: Share2Icon,
      accentClass: ACCENT_TILE.green,
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(financials.total_revenue, currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "gp",
      label: "GP",
      value: formatMoney(financials.total_gp, currency),
      icon: WalletIcon,
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
      id: "payout",
      label: "Pending payout",
      value: formatMoney(financials.pending_payout, currency),
      icon: FileTextIcon,
      accentClass: ACCENT_TILE.pink,
    },
  ];

  return <KpiCarousel items={items} showNavigation={false} className="pb-1" />;
}
