import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorSearchWorkspace } from "@/features/discovery/components/creator-search/creator-search-workspace";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import {
  getCampaignOptionsForShortlist,
  getDiscoveryShortlists,
} from "@/features/discovery/queries";
import { getDiscoverySearchTaxonomy } from "@/lib/discovery/search-taxonomy";

export default async function CreatorSearchPage() {
  const [shortlists, campaigns, searchTaxonomy] = await Promise.all([
    getDiscoveryShortlists(),
    getCampaignOptionsForShortlist(),
    getDiscoverySearchTaxonomy(),
  ]);

  return (
    <DashboardShell
      title="Creator Search"
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/search" />
          <div className="min-h-0 flex-1 overflow-hidden">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading search…
                </div>
              }
            >
              <CreatorSearchWorkspace
                shortlists={shortlists}
                campaigns={campaigns}
                searchTaxonomy={searchTaxonomy}
              />
            </Suspense>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
