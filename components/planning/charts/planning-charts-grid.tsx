"use client";

import { useMemo } from "react";

import { PlanningTrendChart } from "@/components/planning/charts/planning-trend-chart";
import type { PlanningDashboardCharts } from "@/lib/planning/queries/load-planning-dashboard";

type PlanningChartsGridProps = {
  charts: PlanningDashboardCharts;
  mode?: "dashboard" | "variance";
};

export function PlanningChartsGrid({ charts, mode = "dashboard" }: PlanningChartsGridProps) {
  const items = useMemo(() => {
    if (mode === "variance") {
      return [
        {
          title: "Monthly variance trend",
          data: charts.variance_trend,
          stroke: "stroke-amber-500",
          log: "variance-analysis",
        },
        {
          title: "GP variance trend",
          data: charts.gp_variance_trend,
          stroke: "stroke-violet-500",
          log: "variance-analysis",
        },
        {
          title: "Collections variance trend",
          data: charts.collections_variance_trend,
          stroke: "stroke-cyan-500",
          log: "variance-analysis",
        },
      ];
    }
    return [
      {
        title: "Budget trend",
        data: charts.budget_trend,
        stroke: "stroke-primary",
        log: "planning-dashboard",
      },
      {
        title: "Forecast trend",
        data: charts.forecast_trend,
        stroke: "stroke-emerald-500",
        log: "forecast-dashboard",
      },
      {
        title: "Margin trend",
        data: charts.margin_trend,
        stroke: "stroke-violet-500",
        log: "planning-dashboard",
      },
      {
        title: "Variance trend",
        data: charts.variance_trend,
        stroke: "stroke-amber-500",
        log: "variance-analysis",
      },
      {
        title: "Collections trend",
        data: charts.collections_variance_trend,
        stroke: "stroke-cyan-500",
        log: "planning-dashboard",
      },
    ];
  }, [charts, mode]);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <PlanningTrendChart
          key={item.title}
          title={item.title}
          data={item.data}
          strokeClassName={item.stroke}
          logTag={item.log}
        />
      ))}
    </div>
  );
}
