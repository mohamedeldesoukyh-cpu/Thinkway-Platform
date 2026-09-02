import { Suspense } from "react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { FinanceSuiteShell } from "@/components/finance/suite/finance-suite-shell";
import { PlanningWorkspaceView } from "@/features/planning/components/planning-workspace-view-lazy";
import { loadPlanningWorkspace } from "@/features/planning/load-planning-workspace";
import { parsePlanningSearchParams } from "@/lib/planning/dashboard-filters";
import { safePlanningQuery } from "@/lib/platform/safe-query";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterState = parsePlanningSearchParams(params);

  const result = await safePlanningQuery(
    "planning-workspace-page",
    () => loadPlanningWorkspace(filterState),
    null
  );

  const payload = result.data;
  const errorMessage = result.ok
    ? null
    : result.error ?? "Planning workspace could not be loaded.";

  return (
    <FinanceSuiteShell
      title="Planning"
      description="Budgets, forecasts and variance analysis"
    >
      {errorMessage && !payload ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : payload ? (
        <Suspense
          fallback={
            <div className="space-y-4">
              <div className="h-14 animate-pulse rounded-2xl bg-muted" />
              <div className="h-32 animate-pulse rounded-2xl bg-muted" />
            </div>
          }
        >
          <PlatformErrorBoundary surface="planning">
            <PlanningWorkspaceView data={payload} />
          </PlatformErrorBoundary>
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in with planning permissions to access this workspace.
        </p>
      )}
    </FinanceSuiteShell>
  );
}
