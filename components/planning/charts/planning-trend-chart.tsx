"use client";

import { useMemo } from "react";

import {
  buildLinePath,
  DEFAULT_CHART_DIMS,
  formatChartAxisValue,
} from "@/components/dashboard/charts/chart-utils";
import { ChartEmptyState } from "@/components/dashboard/charts/chart-empty-state";
import { ChartCard } from "@/components/dashboard/charts/chart-card";
import type { PlanningTrendPoint } from "@/lib/planning/queries/variance-series";
import { devLog } from "@/lib/platform/logger";

type PlanningTrendChartProps = {
  title: string;
  description?: string;
  data: PlanningTrendPoint[];
  strokeClassName?: string;
  logTag?: string;
};

export function PlanningTrendChart({
  title,
  description,
  data,
  strokeClassName = "stroke-primary",
  logTag = "planning-chart",
}: PlanningTrendChartProps) {
  const chart = useMemo(() => {
    const points = data.map((p) => ({
      period: p.period,
      label: p.label,
      value: p.value,
    }));
    const { path, max } = buildLinePath(points, DEFAULT_CHART_DIMS);
    if (process.env.NODE_ENV === "development") {
      devLog(`[${logTag}] render`, { title, points: points.length });
    }
    return { path, max, points };
  }, [data, title, logTag]);

  return (
    <ChartCard title={title} description={description}>
      {chart.points.length === 0 ? (
        <ChartEmptyState />
      ) : (
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${DEFAULT_CHART_DIMS.width} ${DEFAULT_CHART_DIMS.height}`}
            className="h-[160px] w-full max-w-full"
            role="img"
            aria-label={title}
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
            <span>{chart.points[0]?.label ?? ""}</span>
            <span>{formatChartAxisValue(chart.max)}</span>
            <span>{chart.points[chart.points.length - 1]?.label ?? ""}</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
