"use client";

import {
  HeartIcon,
  PercentIcon,
  ReceiptIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { KPI_ACCENT_CLASS } from "@/components/shared/kpi/kpi-config";
import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import { formatCreatorCount } from "@/features/discovery/components/creator-search/creator-search-utils";
import { QUOTATION_CLIENT_LABELS } from "@/features/quotations/constants";
import { gpHealthTextClass } from "@/features/quotations/quotation-gp-health";

type QuotationKpiStripProps = {
  creatorCount: number;
  audienceSize: number;
  estimatedReach: number;
  estimatedEngagementRate: number | null;
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalGpValueEgp: number;
  totalGpPct: number;
  totalAfEgp: number;
  totalAgencyMarginEgp: number;
  gpTargetPct: number;
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
  audienceSize,
  estimatedReach,
  estimatedEngagementRate,
  totalCostEgp,
  totalRevenueEgp,
  totalGpValueEgp,
  totalGpPct,
  totalAfEgp,
  totalAgencyMarginEgp,
  gpTargetPct,
}: QuotationKpiStripProps) {
  const gpHealthInput = {
    gpValueEgp: totalGpValueEgp,
    gpPct: totalGpPct,
    targetPct: gpTargetPct,
  };
  const gpValueClass = gpHealthTextClass(gpHealthInput);

  const items: KpiCarouselItem[] = [
    {
      id: "creators",
      label: "Creators",
      value: String(creatorCount),
      icon: UsersIcon,
      accentKey: "blue",
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "audience",
      label: "Audience Size",
      value: formatCreatorCount(audienceSize),
      icon: UsersIcon,
      accentKey: "blue",
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "reach",
      label: "Est. Reach",
      value: formatCreatorCount(estimatedReach),
      icon: UsersIcon,
      accentKey: "green",
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
      accentKey: "purple",
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "cost",
      label: "Total Cost",
      value: egp(totalCostEgp),
      icon: ReceiptIcon,
      accentKey: "pink",
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "revenue",
      label: QUOTATION_CLIENT_LABELS.totalClientCost,
      value: egp(totalRevenueEgp),
      icon: TrendingUpIcon,
      accentKey: "purple",
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "gp",
      label: "Gross Profit",
      value: egp(totalGpValueEgp),
      icon: TrendingUpIcon,
      accentKey: "green",
      valueClassName: gpValueClass,
    },
    {
      id: "gp_pct",
      label: "GP %",
      value: `${totalGpPct.toFixed(1)}%`,
      icon: PercentIcon,
      accentKey: "blue",
      valueClassName: gpValueClass,
    },
    {
      id: "af",
      label: QUOTATION_CLIENT_LABELS.totalAgencyFee,
      value: egp(totalAfEgp),
      icon: ReceiptIcon,
      accentKey: "purple",
      valueClassName: NEUTRAL_VALUE,
    },
    {
      id: "agency_margin",
      label: QUOTATION_CLIENT_LABELS.totalAgencyMargin,
      value: egp(totalAgencyMarginEgp),
      icon: TrendingUpIcon,
      accentKey: "green",
      valueClassName: NEUTRAL_VALUE,
    },
  ];

  return <KpiStrip items={items} showNavigation={false} />;
}
