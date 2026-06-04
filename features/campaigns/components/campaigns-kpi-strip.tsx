"use client";

import {
  MegaphoneIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
  className?: string;
};

const ACCENT_TILE = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
} as const;

export function CampaignsKpiStrip({ kpis, className }: CampaignsKpiStripProps) {
  const items = [
    {
      id: "total",
      label: "Total campaigns",
      value: String(kpis.total_campaigns),
      icon: MegaphoneIcon,
      accentClass: ACCENT_TILE.blue,
    },
    {
      id: "revenue",
      label: "Total revenue",
      value: formatMoney(kpis.total_revenue, kpis.currency_code),
      icon: WalletIcon,
      accentClass: ACCENT_TILE.purple,
    },
    {
      id: "margin",
      label: "Avg margin",
      value: `${kpis.avg_margin.toFixed(1)}%`,
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.pink,
    },
    {
      id: "assignments",
      label: "Assignments",
      value: String(kpis.assignments),
      icon: UsersIcon,
      accentClass: ACCENT_TILE.green,
    },
  ];

  return (
    <KpiCarousel
      items={items}
      showNavigation={false}
      className={cn("pb-1", className)}
    />
  );
}
