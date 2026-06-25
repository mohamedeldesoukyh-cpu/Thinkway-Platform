"use client";

import {
  HeartIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { KpiCarousel, type KpiCarouselItem } from "@/components/ui/kpi-carousel";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { gpHealthTextClass } from "@/features/quotations/quotation-gp-health";

type QuotationKpiStripProps = {
  creatorCount: number;
  estimatedReach: number;
  estimatedEngagementRate: number | null;
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
  gpTargetPct: number;
};

type KpiAccent = "blue" | "purple" | "pink" | "green";

const ACCENT_TILE: Record<KpiAccent, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  pink: "bg-brand-pink/10 text-brand-pink",
  green: "bg-success/10 text-success",
};

const NEUTRAL_VALUE = "text-foreground";

function egp(n: number): string {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)} EGP`;
}

export function QuotationKpiStrip({
  creatorCount,
  estimatedReach,
  estimatedEngagementRate,
  totalCostEgp,
  totalRevenueEgp,
  totalGpValueEgp,
  totalGpPct,
  gpTargetPct,
}: QuotationKpiStripProps) {
  const gpHealthInput = {
    gpValueEgp: totalGpValueEgp,
    gpPct: totalGpPct,
    targetPct: gpTargetPct,
  };
  const gpValueClass = gpHealthTextClass(gpHealthInput);

  const items = [
    {
      id: "creators",
      label: "Creators",
      value: String(creatorCount),
      icon: UsersIcon,
      accentClass: ACCENT_TILE.blue,
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "reach",
      label: "Est. Reach",
      value: formatCreatorCount(estimatedReach),
      icon: UsersIcon,
      accentClass: ACCENT_TILE.green,
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "engagement",
      label: "Est. Engagement",
      value:
        estimatedEngagementRate != null
          ? `${estimatedEngagementRate.toFixed(1)}%`
          : "—",
      icon: HeartIcon,
      accentClass: ACCENT_TILE.purple,
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "cost",
      label: "Total Cost",
      value: egp(totalCostEgp),
      icon: ReceiptIcon,
      accentClass: ACCENT_TILE.pink,
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "revenue",
      label: QUOTATION_CLIENT_LABELS.totalClientCost,
      value: egp(totalRevenueEgp),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.purple,
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "gp",
      label: "Gross Profit",
      value: egp(totalGpValueEgp),
      icon: TrendingUpIcon,
      accentClass: ACCENT_TILE.green,
      valueClassName: gpValueClass,
    },
    {
      id: "gp_pct",
      label: "GP %",
      value: `${totalGpPct.toFixed(1)}%`,
      icon: PercentIcon,
      accentClass: ACCENT_TILE.blue,
      valueClassName: gpValueClass,
    },
  ] satisfies {
    id: string;
    label: string;
    value: string;
    icon: LucideIcon;
    accentClass: string;
    valueClassName: string;
  }[];

  return <KpiCarousel items={items as KpiCarouselItem[]} showNavigation={false} />;
}
