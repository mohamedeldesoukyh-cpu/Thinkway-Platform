"use client";

import type { CampaignPerformanceCharts } from "@/features/campaigns/queries/publications";
import { formatCompactCount } from "@/lib/campaigns/performance-calculations";
import { cn } from "@/lib/utils";

type Props = {
  charts: CampaignPerformanceCharts;
};

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
    <div className={cn("rounded-xl border border-[#E6EAF2] bg-white p-4", className)}>
      <h3 className="mb-3 text-[11px] font-semibold tracking-wide text-[#9099A8] uppercase">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => {
            const value = Number(item[valueKey] ?? 0);
            const label = String(item[labelKey] ?? "");
            return (
              <div key={`${label}-${i}`} className="grid grid-cols-[100px_1fr_48px] items-center gap-2">
                <span className="truncate text-[11px] text-[#5B6575]" title={label}>
                  {label}
                </span>
                <div className="h-2 rounded-full bg-[#F5F8FD]">
                  <div
                    className="h-2 rounded-full bg-[#0057FF]"
                    style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
                  />
                </div>
                <span className="text-right text-[10px] font-medium tabular-nums text-[#0B0F1A]">
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

export function CampaignPerformanceCharts({ charts }: Props) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
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
