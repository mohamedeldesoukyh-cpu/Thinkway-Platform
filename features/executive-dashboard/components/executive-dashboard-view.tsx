"use client";

import { Suspense } from "react";

import { ExecutiveChartsGrid } from "@/components/dashboard/charts/executive-charts-grid";
import { DashboardFilterBar } from "@/features/executive-dashboard/components/dashboard-filter-bar";
import { ExecutiveKpiStrip } from "@/features/executive-dashboard/components/executive-kpi-strip";
import { FinanceAlertsPanel } from "@/features/executive-dashboard/components/finance-alerts-panel";
import { ProfitabilitySection } from "@/features/executive-dashboard/components/profitability-section";
import type {
  DashboardFilterOptions,
  ExecutiveDashboardPayload,
} from "@/features/analytics/load-executive-dashboard";

type ExecutiveDashboardViewProps = {
  data: ExecutiveDashboardPayload;
  filterOptions: DashboardFilterOptions;
};

export function ExecutiveDashboardView({
  data,
  filterOptions,
}: ExecutiveDashboardViewProps) {
  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="h-14 animate-pulse rounded-2xl bg-muted" />}>
        <DashboardFilterBar options={filterOptions} />
      </Suspense>

      <ExecutiveKpiStrip strip={data.executive_kpis} />

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Performance trends
        </h2>
        <ExecutiveChartsGrid charts={data.charts} />
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProfitabilitySection tables={data.profitability_tables} />
        </div>
        <div className="xl:col-span-1">
          <FinanceAlertsPanel alerts={data.alerts} />
        </div>
      </div>
    </div>
  );
}
