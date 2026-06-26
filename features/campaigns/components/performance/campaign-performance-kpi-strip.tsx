"use client";

import {
  BarChart3Icon,
  EyeIcon,
  HeartIcon,
  MegaphoneIcon,
  PercentIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";

import { KPI_ACCENT_CLASS, KPI_PERFORMANCE_ACCENT } from "@/components/shared/kpi/kpi-config";
import { KpiStrip, type KpiCarouselItem } from "@/components/shared/kpi/kpi-strip";
import type { CampaignPerformanceSummary } from "@/features/campaigns/queries/publications";
import {
  formatCompactCount,
  formatMoneyValue,
  formatPercent,
} from "@/lib/campaigns/performance-calculations";

type Props = {
  summary: CampaignPerformanceSummary;
};

export function CampaignPerformanceKpiStrip({ summary }: Props) {
  const items: KpiCarouselItem[] = [
    {
      id: "pubs",
      label: "Total Publications",
      value: String(summary.total_publications),
      icon: MegaphoneIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.blue],
    },
    {
      id: "reach",
      label: "Total Reach",
      value: formatCompactCount(summary.total_reach),
      subtext: `Actual ${formatCompactCount(summary.total_actual_reach)} · Forecast ${formatCompactCount(summary.total_forecast_reach)}`,
      icon: UsersIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.green],
    },
    {
      id: "impressions",
      label: "Total Impressions",
      value: formatCompactCount(summary.total_impressions),
      subtext: `Actual ${formatCompactCount(summary.total_actual_impressions)} · Forecast ${formatCompactCount(summary.total_forecast_impressions)}`,
      icon: EyeIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.purple],
    },
    {
      id: "views",
      label: "Total Views",
      value: formatCompactCount(summary.total_views),
      icon: BarChart3Icon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.blue],
    },
    {
      id: "engagements",
      label: "Total Engagements",
      value: formatCompactCount(summary.total_engagements),
      icon: HeartIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.green],
    },
    {
      id: "er",
      label: "Average ER",
      value: formatPercent(summary.average_engagement_rate),
      icon: PercentIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.amber],
    },
    {
      id: "cpm",
      label: "CPM",
      value: formatMoneyValue(summary.average_cpm, summary.currency),
      icon: TrendingUpIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.purple],
    },
    {
      id: "cpv",
      label: "CPV",
      value: formatMoneyValue(summary.average_cpv, summary.currency),
      icon: TrendingUpIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.blue],
    },
    {
      id: "top",
      label: "Top Performing Creator",
      value: summary.top_creator_name ?? "—",
      icon: UsersIcon,
      accentClass: KPI_ACCENT_CLASS[KPI_PERFORMANCE_ACCENT.green],
    },
  ];

  return <KpiStrip items={items} />;
}
