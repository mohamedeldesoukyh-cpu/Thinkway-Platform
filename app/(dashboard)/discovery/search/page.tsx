import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorSearchWorkspace } from "@/features/discovery/components/creator-search/creator-search-workspace";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { loadCampaignIntelligenceWorkspaceAction } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import {
  getCampaignOptionsForShortlist,
  getDiscoveryShortlists,
} from "@/features/discovery/queries";
import { getDiscoverySearchTaxonomy } from "@/lib/discovery/search-taxonomy";

type PageProps = {
  searchParams: Promise<{ profileId?: string }>;
};

export default async function CreatorSearchPage({ searchParams }: PageProps) {
  const { profileId } = await searchParams;
  const [shortlists, campaigns, searchTaxonomy, initialBriefState] = await Promise.all([
    getDiscoveryShortlists(),
    getCampaignOptionsForShortlist(),
    getDiscoverySearchTaxonomy(),
    profileId?.trim()
      ? loadCampaignIntelligenceWorkspaceAction(profileId.trim())
      : Promise.resolve(null),
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
                initialBriefState={initialBriefState}
              />
            </Suspense>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
