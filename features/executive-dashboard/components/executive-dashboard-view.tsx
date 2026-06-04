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
    <div className="space-y-4">
      <Suspense
        fallback={
          <div className="h-20 animate-pulse rounded-xl border border-border/70 bg-muted/40" />
        }
      >
        <DashboardFilterBar options={filterOptions} />
      </Suspense>

      <ExecutiveKpiStrip strip={data.executive_kpis} />

      <section className="space-y-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">
            Performance trends
          </h2>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Revenue, GP, billing, collections, and PO consumption by period.
          </p>
        </div>
        <ExecutiveChartsGrid charts={data.charts} />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
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
