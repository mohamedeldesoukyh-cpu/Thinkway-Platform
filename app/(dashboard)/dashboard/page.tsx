import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ExecutiveDashboardView } from "@/features/executive-dashboard/components/executive-dashboard-view";
import {
  loadDashboardFilterOptions,
  loadExecutiveDashboard,
} from "@/features/analytics/load-executive-dashboard";
import {
  dashboardFiltersToAnalytics,
  parseDashboardSearchParams,
} from "@/lib/analytics/dashboard-filters";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExecutiveDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterState = parseDashboardSearchParams(params);
  const analyticsFilters = dashboardFiltersToAnalytics(filterState);

  let errorMessage: string | null = null;
  let payload = null;
  let filterOptions = null;

  try {
    [payload, filterOptions] = await Promise.all([
      loadExecutiveDashboard(analyticsFilters),
      loadDashboardFilterOptions(),
    ]);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load executive dashboard.";
  }

  return (
    <DashboardShell
      title="Executive dashboard"
      description="CFO-grade finance monitoring — revenue, profitability, collections, and operational exposure."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : payload && filterOptions ? (
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-14 animate-pulse rounded-2xl bg-muted" />
              <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            </div>
          }
        >
          <ExecutiveDashboardView data={payload} filterOptions={filterOptions} />
        </Suspense>
      ) : null}
    </DashboardShell>
  );
}
