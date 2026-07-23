"use client";

import { Suspense } from "react";
import { SparklesIcon } from "lucide-react";

import { PlatformV6PageSectionHeader } from "@/components/platform/platform-v6-layout";
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
    <div className="space-y-5">
      <Suspense
        fallback={
          <div className="h-20 animate-pulse rounded-[10px] border border-[var(--tw-border,#e2e8f0)] bg-white" />
        }
      >
        <DashboardFilterBar options={filterOptions} />
      </Suspense>

      {data.ai_insight ? (
        <div className="platform-v6-ai-insights">
          <div className="platform-v6-ai-insights-icon">
            <SparklesIcon aria-hidden strokeWidth={2} />
          </div>
          <div className="platform-v6-ai-insights-body">
            <div className="platform-v6-ai-insights-label">Thinkway Intelligence</div>
            <div className="platform-v6-ai-insights-text">{data.ai_insight}</div>
          </div>
        </div>
      ) : null}

      <ExecutiveKpiStrip strip={data.executive_kpis} />

      <section>
        <PlatformV6PageSectionHeader
          compact
          title="Performance trends"
          description="Revenue, GP, billing, collections, and PO consumption by period."
        />
        <ExecutiveChartsGrid charts={data.charts} />
      </section>

      <div className="platform-v6-dash-layout">
        <ProfitabilitySection tables={data.profitability_tables} />
        <FinanceAlertsPanel alerts={data.alerts} />
      </div>
    </div>
  );
}
