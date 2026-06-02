"use client";

import { useMemo } from "react";

import {
  buildLinePath,
  DEFAULT_CHART_DIMS,
  formatChartAxisValue,
} from "@/components/dashboard/charts/chart-utils";
import { ChartEmptyState } from "@/components/dashboard/charts/chart-empty-state";
import { devLog } from "@/lib/dev-log";
import type { DashboardTrendPoint } from "@/lib/analytics/queries/dashboard-charts";

type TrendLineChartProps = {
  data: DashboardTrendPoint[];
  strokeClassName?: string;
  ariaLabel: string;
};

export function TrendLineChart({
  data,
  strokeClassName = "stroke-primary",
  ariaLabel,
}: TrendLineChartProps) {
  const chart = useMemo(() => {
    const filtered = data.filter((p) => p.period !== "unscheduled");
    const { path, max } = buildLinePath(filtered, DEFAULT_CHART_DIMS);
    if (process.env.NODE_ENV === "development") {
      devLog("[dashboard-chart] render trend line", {
        points: filtered.length,
        ariaLabel,
      });
    }
    return { path, max, filtered };
  }, [data, ariaLabel]);

  if (chart.filtered.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${DEFAULT_CHART_DIMS.width} ${DEFAULT_CHART_DIMS.height}`}
        className="h-[160px] w-full max-w-full"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        <line
          x1={DEFAULT_CHART_DIMS.paddingX}
          y1={DEFAULT_CHART_DIMS.height - DEFAULT_CHART_DIMS.paddingY}
          x2={DEFAULT_CHART_DIMS.width - DEFAULT_CHART_DIMS.paddingX}
          y2={DEFAULT_CHART_DIMS.height - DEFAULT_CHART_DIMS.paddingY}
          className="stroke-border"
          strokeWidth="1"
        />
        {chart.path ? (
          <path
            d={chart.path}
            fill="none"
            className={strokeClassName}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{chart.filtered[0]?.label ?? ""}</span>
        <span>{formatChartAxisValue(chart.max)}</span>
        <span>{chart.filtered[chart.filtered.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}
