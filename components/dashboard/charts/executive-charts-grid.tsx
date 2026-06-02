"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { ChartCard } from "@/components/dashboard/charts/chart-card";
import { ChartSkeleton } from "@/components/dashboard/charts/chart-skeleton";
import type { ExecutiveDashboardCharts } from "@/lib/analytics/queries/dashboard-charts";

const TrendLineChart = dynamic(
  () =>
    import("@/components/dashboard/charts/trend-line-chart").then(
      (m) => m.TrendLineChart
    ),
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
        stroke: "stroke-emerald-600 dark:stroke-emerald-400",
      },
      {
        key: "gp",
        title: "GP trend",
        description: "Gross profit by campaign start month",
        data: charts.gp_trend,
        stroke: "stroke-sky-600 dark:stroke-sky-400",
      },
      {
        key: "billing",
        title: "Billing trend",
        description: "Invoiced amount by issue month",
        data: charts.billing_trend,
        stroke: "stroke-violet-600 dark:stroke-violet-400",
      },
      {
        key: "collections",
        title: "Collections trend",
        description: "Cash collected by payment month",
        data: charts.collections_trend,
        stroke: "stroke-amber-600 dark:stroke-amber-400",
      },
      {
        key: "po",
        title: "PO consumption trend",
        description: "PO consumed by campaign start month",
        data: charts.po_consumption_trend,
        stroke: "stroke-rose-600 dark:stroke-rose-400",
      },
    ],
    [charts]
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {series.map((item) => (
        <ChartCard
          key={item.key}
          title={item.title}
          description={item.description}
          className={item.key === "po" ? "xl:col-span-1" : undefined}
        >
          <TrendLineChart
            data={item.data}
            strokeClassName={item.stroke}
            ariaLabel={item.title}
          />
        </ChartCard>
      ))}
    </div>
  );
}
