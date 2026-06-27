"use client";

import type { CampaignPerformanceCharts } from "@/features/campaigns/queries/publications";
import { formatCompactCount } from "@/lib/campaigns/performance-calculations";
import { cn } from "@/lib/utils";

type Props = {
  charts: CampaignPerformanceCharts;
  className?: string;
};

const CHART_BAR_PALETTE = [
  "var(--login-blue)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
] as const;

function resolveBarColor(label: string, index: number): string {
  const key = label.trim().toLowerCase();

  if (key.includes("instagram") || key === "ig" || key.startsWith("ig ")) {
    return "#E1306C";
  }
  if (key.includes("tiktok") || key === "tt" || key.startsWith("tt ")) {
    return "#25F4EE";
  }
  if (key.includes("youtube") || key === "yt") {
    return "#FF0000";
  }
  if (key.includes("snap")) {
    return "#FFFC00";
  }

  return CHART_BAR_PALETTE[index % CHART_BAR_PALETTE.length];
}

function BarChart({
  title,
  items,
  valueKey,
  labelKey,
  className,
}: {
  title: string;
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  className?: string;
}) {
  const max = Math.max(...items.map((i) => Number(i[valueKey] ?? 0)), 1);

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const value = Number(item[valueKey] ?? 0);
            const label = String(item[labelKey] ?? "");
            const barColor = resolveBarColor(label, i);
            return (
              <div key={`${label}-${i}`} className="grid grid-cols-[100px_1fr_48px] items-center gap-2">
                <span className="truncate text-[11px] text-muted-foreground" title={label}>
                  {label}
                </span>
                <div className="h-2 rounded-full bg-muted/80">
                  <div
                    className="h-2 rounded-full transition-[width] duration-300"
                    style={{
                      width: `${Math.max(4, (value / max) * 100)}%`,
                      backgroundColor: barColor,
                    }}
                  />
                </div>
                <span className="text-right text-[10px] font-medium tabular-nums text-foreground">
                  {formatCompactCount(value)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function countPerformanceChartSeries(charts: CampaignPerformanceCharts): number {
  return [
    charts.performance_over_time,
    charts.platform_split,
    charts.content_type_split,
    charts.top_creators_by_engagement,
    charts.reach_by_creator,
    charts.views_by_publication,
    charts.engagement_distribution,
  ].filter((series) => series.length > 0).length;
}

export function CampaignPerformanceCharts({ charts, className }: Props) {
  return (
    <div className={cn("grid gap-3 lg:grid-cols-2 xl:grid-cols-3", className)}>
      <BarChart
        title="Performance over time (views)"
        items={charts.performance_over_time.map((d) => ({
          label: d.date,
          value: d.views,
        }))}
        labelKey="label"
        valueKey="value"
      />
      <BarChart
        title="Platform split"
        items={charts.platform_split.map((d) => ({
          label: d.label,
          value: d.engagements,
        }))}
        labelKey="label"
        valueKey="value"
      />
      <BarChart
        title="Content type split"
        items={charts.content_type_split.map((d) => ({
          label: d.label,
          value: d.count,
        }))}
        labelKey="label"
        valueKey="value"
      />
      <BarChart
        title="Top creators by engagement"
        items={charts.top_creators_by_engagement.map((d) => ({
          label: d.name,
          value: d.engagements,
        }))}
        labelKey="label"
        valueKey="value"
      />
      <BarChart
        title="Reach by creator"
        items={charts.reach_by_creator.map((d) => ({
          label: d.name,
          value: d.reach,
        }))}
        labelKey="label"
        valueKey="value"
      />
      <BarChart
        title="Views by publication"
        items={charts.views_by_publication.map((d) => ({
          label: d.label,
          value: d.views,
        }))}
        labelKey="label"
        valueKey="value"
      />
      <BarChart
        title="Engagement distribution"
        items={charts.engagement_distribution.map((d) => ({
          label: d.bucket,
          value: d.count,
        }))}
        labelKey="label"
        valueKey="value"
        className="lg:col-span-2 xl:col-span-1"
      />
    </div>
  );
}
