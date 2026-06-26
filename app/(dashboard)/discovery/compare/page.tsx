import Link from "next/link";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCompareWorkspace } from "@/features/discovery/components/creator-compare/creator-compare-workspace";
import { getDiscoveryShortlists } from "@/features/discovery/queries";
import { cn } from "@/lib/utils";

export default async function CreatorComparePage() {
  const shortlists = await getDiscoveryShortlists();

  return (
    <DashboardShell
      title="Creator Comparison"
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <nav
            aria-label="Discovery"
            className="flex shrink-0 items-center gap-4 border-b border-border bg-background px-4 py-2 text-[12px] md:px-5"
          >
            <Link
              href="/discovery/search"
              className="font-medium text-muted-foreground hover:text-primary"
            >
              Creator Search
            </Link>
            <Link
              href="/discovery/compare"
              className={cn("font-semibold text-primary")}
              aria-current="page"
            >
              Compare
            </Link>
            <Link
              href="/discovery"
              className="font-medium text-muted-foreground hover:text-primary"
            >
              Discovery hub
            </Link>
          </nav>
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense
              fallback={
                <div className="flex flex-1 items-center justify-center py-24 text-sm text-[#9099A8]">
                  Loading comparison…
                </div>
              }
            >
              <CreatorCompareWorkspace shortlists={shortlists} />
            </Suspense>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
