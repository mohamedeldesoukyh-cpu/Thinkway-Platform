import { Suspense } from "react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
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
import { getRequestAuth } from "@/lib/supabase/server";

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
  let userHandle = "signed-in";

  try {
    const [exec, options, auth] = await Promise.all([
      loadExecutiveDashboard(analyticsFilters),
      loadDashboardFilterOptions(),
      getRequestAuth(),
    ]);
    payload = exec;
    filterOptions = options;
    userHandle =
      auth.user?.email?.split("@")[0] ??
      auth.fullName?.split(/\s+/)[0] ??
      "signed-in";
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load executive dashboard.";
  }

  return (
    <DashboardShell
      title="Executive dashboard"
      platformV6
      hidePageHeader
      immersiveLayout
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      {errorMessage ? (
        <div className="m-5 rounded-[10px] border border-destructive/30 bg-destructive/10 px-4 py-3 text-[11px] text-destructive">
          {errorMessage}
        </div>
      ) : payload && filterOptions ? (
        <Suspense
          fallback={
            <div className="tw-pad">
              <div className="tw-cs">Loading executive dashboard…</div>
            </div>
          }
        >
          <PlatformErrorBoundary surface="executive">
            <ExecutiveDashboardView
              data={payload}
              filterOptions={filterOptions}
              userHandle={userHandle}
            />
          </PlatformErrorBoundary>
        </Suspense>
      ) : null}
    </DashboardShell>
  );
}
