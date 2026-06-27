"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { ChartSkeleton } from "@/components/dashboard/charts/chart-skeleton";
import type { ExecutiveDashboardCharts } from "@/lib/analytics/queries/dashboard-charts";
import { cn } from "@/lib/utils";

const TrendBarChart = dynamic(
  () =>
    import("@/components/dashboard/charts/trend-bar-chart").then((m) => m.TrendBarChart),
  { loading: () => <ChartSkeleton />, ssr: false }
);

type ExecutiveChartsGridProps = {
  charts: ExecutiveDashboardCharts;
};

export function ExecutiveChartsGrid({ charts }: ExecutiveChartsGridProps) {
  const series = useMemo(
    () => [
      {
        key: "revenue",
        title: "Revenue trend",
        description: "Planned revenue by campaign start month",
        data: charts.revenue_trend,
        barColor: "#2563eb",
        wide: false,
      },
      {
        key: "gp",
        title: "GP trend",
        description: "Gross profit by campaign start month",
        data: charts.gp_trend,
        barColor: "#a855f7",
        wide: false,
      },
      {
        key: "billing",
        title: "Billing trend",
        description: "Invoiced amount by issue month",
        data: charts.billing_trend,
        barColor: "#10b981",
        wide: false,
      },
      {
        key: "collections",
        title: "Collections trend",
        description: "Cash collected by payment month",
        data: charts.collections_trend,
        barColor: "#f59e0b",
        wide: true,
      },
      {
        key: "po",
        title: "PO consumption trend",
        description: "PO consumed by campaign start month",
        data: charts.po_consumption_trend,
        barColor: "#3b82f6",
        wide: false,
      },
    ],
    [charts]
  );

  return (
    <div className="platform-v6-trend-grid">
      {series.map((item) => (
        <div
          key={item.key}
          className={cn("platform-v6-trend-card", item.wide && "platform-v6-trend-card-wide")}
        >
          <h4>{item.title}</h4>
          <p>{item.description}</p>
          <TrendBarChart data={item.data} barColor={item.barColor} ariaLabel={item.title} />
        </div>
      ))}
    </div>
  );
}
