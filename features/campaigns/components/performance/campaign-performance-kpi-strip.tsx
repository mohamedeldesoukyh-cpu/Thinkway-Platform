"use client";

import {
  BarChart3Icon,
  EyeIcon,
  HeartIcon,
  MegaphoneIcon,
  PercentIcon,
  TrendingUpIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { KpiCarousel } from "@/components/ui/kpi-carousel";
import type { CampaignPerformanceSummary } from "@/features/campaigns/queries/publications";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";

type Props = {
  summary: CampaignPerformanceSummary;
};

const ACCENT = {
  blue: "bg-[#EEF4FF] text-[#0057FF]",
  green: "bg-[#E8F8F3] text-[#1D9E75]",
  purple: "bg-brand-purple/10 text-brand-purple",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
} as const;

export function CampaignPerformanceKpiStrip({ summary }: Props) {
  const items = [
    {
      id: "pubs",
      label: "Total Publications",
      value: String(summary.total_publications),
      icon: MegaphoneIcon,
      accentClass: ACCENT.blue,
    },
    {
      id: "reach",
      label: "Total Reach",
      value: formatCompactCount(summary.total_reach),
      icon: UsersIcon,
      accentClass: ACCENT.green,
    },
    {
      id: "impressions",
      label: "Total Impressions",
      value: formatCompactCount(summary.total_impressions),
      icon: EyeIcon,
      accentClass: ACCENT.purple,
    },
    {
      id: "views",
      label: "Total Views",
      value: formatCompactCount(summary.total_views),
      icon: BarChart3Icon,
      accentClass: ACCENT.blue,
    },
    {
      id: "engagements",
      label: "Total Engagements",
      value: formatCompactCount(summary.total_engagements),
      icon: HeartIcon,
      accentClass: ACCENT.green,
    },
    {
      id: "er",
      label: "Average ER",
      value: formatPercent(summary.average_engagement_rate),
      icon: PercentIcon,
      accentClass: ACCENT.amber,
    },
    {
      id: "cpm",
      label: "CPM",
      value: formatMoneyValue(summary.average_cpm, summary.currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT.purple,
    },
    {
      id: "cpv",
      label: "CPV",
      value: formatMoneyValue(summary.average_cpv, summary.currency),
      icon: TrendingUpIcon,
      accentClass: ACCENT.blue,
    },
    {
      id: "top",
      label: "Top Performing Creator",
      value: summary.top_creator_name ?? "—",
      icon: UsersIcon,
      accentClass: ACCENT.green,
    },
  ] satisfies {
    id: string;
    label: string;
    value: string;
    icon: LucideIcon;
    accentClass: string;
  }[];

  return <KpiCarousel items={items} />;
}
