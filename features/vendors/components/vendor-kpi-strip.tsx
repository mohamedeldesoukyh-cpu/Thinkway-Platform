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

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { VendorWorkspace } from "@/features/vendors/types";
import { formatMoney, formatPercent } from "@/features/vendors/utils";

type VendorKpiStripProps = {
  workspace: VendorWorkspace;
};

export function VendorKpiStrip({ workspace }: VendorKpiStripProps) {
  const { counts, financials } = workspace;
  const currency =
    (workspace.payment_details as { currency?: string })?.currency ?? "USD";

  const items: KpiCarouselItem[] = [
    {
      id: "assignments",
      label: "Assignments",
      value: String(counts.assignments),
      icon: UsersIcon,
      accentKey: "purple",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      value: String(counts.campaigns),
      icon: MegaphoneIcon,
      accentKey: "blue",
    },
    {
      id: "deliverables",
      label: "Deliverables",
      value: String(counts.deliverables),
      icon: LayersIcon,
      accentKey: "pink",
    },
    {
      id: "platforms",
      label: "Platforms",
      value: String(counts.platforms),
      icon: Share2Icon,
      accentKey: "green",
    },
    {
      id: "revenue",
      label: "Revenue",
      value: formatMoney(financials.total_revenue, currency),
      icon: TrendingUpIcon,
      accentKey: "purple",
    },
    {
      id: "gp",
      label: "GP",
      value: formatMoney(financials.total_gp, currency),
      icon: WalletIcon,
      accentKey: "green",
    },
    {
      id: "margin",
      label: "Margin",
      value: formatPercent(financials.margin_percent),
      icon: PercentIcon,
      accentKey: "blue",
    },
    {
      id: "payout",
      label: "Pending payout",
      value: formatMoney(financials.pending_payout, currency),
      icon: FileTextIcon,
      accentKey: "pink",
    },
  ];

  return <KpiStrip items={items} showNavigation={false} className="pb-1" />;
}
