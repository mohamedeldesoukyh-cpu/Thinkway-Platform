"use client";

import { useMemo } from "react";

import { ChartEmptyState } from "@/components/dashboard/charts/chart-empty-state";
import { formatChartAxisValue } from "@/components/dashboard/charts/chart-utils";
import { devLog } from "@/lib/dev-log";
import type { DashboardTrendPoint } from "@/lib/analytics/queries/dashboard-charts";

type TrendBarChartProps = {
  data: DashboardTrendPoint[];
  barColor?: string;
  ariaLabel: string;
};

export function TrendBarChart({
  data,
  barColor = "#2563eb",
  ariaLabel,
}: TrendBarChartProps) {
  const chart = useMemo(() => {
    const filtered = data.filter((p) => p.period !== "unscheduled");
    const max = Math.max(...filtered.map((p) => p.value), 1);
    if (process.env.NODE_ENV === "development") {
      devLog("[dashboard-chart] render trend bars", {
        points: filtered.length,
        ariaLabel,
      });
    }
    return { filtered, max };
  }, [data, ariaLabel]);

  if (chart.filtered.length === 0) {
    return <ChartEmptyState />;
  }

  if (chart.filtered.length === 1) {
    const point = chart.filtered[0];
    return (
      <div
        className="platform-v6-trend-single"
        role="img"
        aria-label={`${ariaLabel}: ${formatChartAxisValue(point.value)} in ${point.label}`}
      >
        <div className="platform-v6-trend-single-val">
          {formatChartAxisValue(point.value)}
        </div>
        <div className="platform-v6-trend-single-period">{point.label}</div>
        <p className="platform-v6-trend-single-caption">
          Trend appears once 2+ periods are available
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="platform-v6-sparkline" role="img" aria-label={ariaLabel}>
        {chart.filtered.map((point) => (
          <div
            key={point.period}
            className="platform-v6-spark-bar"
            style={{
              height: `${Math.max(4, (point.value / chart.max) * 100)}%`,
              backgroundColor: barColor,
            }}
          />
        ))}
      </div>
      <div className="platform-v6-chart-foot">
        <span>{chart.filtered[0]?.label ?? ""}</span>
        <span>{formatChartAxisValue(chart.max)}</span>
        <span>{chart.filtered[chart.filtered.length - 1]?.label ?? ""}</span>
      </div>
    </div>
  );
}
