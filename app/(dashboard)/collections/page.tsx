export const dynamic = "force-dynamic";

import { Suspense } from "react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CollectionsWorkspaceView } from "@/features/collections/components/collections-workspace-view";
import { loadCollectionsWorkspace } from "@/features/collections/load-workspace";
import { parseCollectionsSearchParams } from "@/lib/collections/dashboard-filters";
import { safeAnalyticsQuery } from "@/lib/platform/safe-query";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CollectionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterState = parseCollectionsSearchParams(params);

  const result = await safeAnalyticsQuery(
    "collections-workspace-page",
    () => loadCollectionsWorkspace(filterState),
    null
  );

  const payload = result.data;
  const errorMessage = result.ok
    ? null
    : result.error ?? "Collections workspace could not be loaded.";

  return (
    <DashboardShell
      title="Collections"
      description="AR aging, payment allocation, client statements, and collections forecasting — powered by centralized analytics."
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
          <PlatformErrorBoundary surface="collections">
            <CollectionsWorkspaceView data={payload} />
          </PlatformErrorBoundary>
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">
          Sign in with collections permissions to access this workspace.
        </p>
      )}
    </DashboardShell>
  );
}
