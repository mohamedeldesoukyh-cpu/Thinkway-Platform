"use client";

import {
  MegaphoneIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { CampaignsKpis } from "@/features/campaigns/queries";
import { formatMoney } from "@/features/campaigns/utils";
import { cn } from "@/lib/utils";

type CampaignsKpiStripProps = {
  kpis: CampaignsKpis;
  className?: string;
};

export function CampaignsKpiStrip({ kpis, className }: CampaignsKpiStripProps) {
  const items: KpiCarouselItem[] = [
    {
      id: "total",
      label: "Total campaigns",
      value: String(kpis.total_campaigns),
      icon: MegaphoneIcon,
      accentKey: "blue",
      valueSemantic: "count",
    },
    {
      id: "revenue",
      label: "Total revenue",
      value: formatMoney(kpis.total_revenue, kpis.currency_code),
      icon: WalletIcon,
      accentKey: "purple",
      valueSemantic: "revenue",
    },
    {
      id: "margin",
      label: "Avg margin",
      value: `${kpis.avg_margin.toFixed(1)}%`,
      icon: TrendingUpIcon,
      accentKey: "pink",
      valueSemantic: "margin",
      valueNumeric: kpis.avg_margin,
    },
    {
      id: "assignments",
      label: "Assignments",
      value: String(kpis.assignments),
      icon: UsersIcon,
      accentKey: "green",
      valueSemantic: "count",
    },
  ];

  return (
    <KpiStrip
      items={items}
      showNavigation={false}
      className={cn("pb-1", className)}
    />
  );
}
