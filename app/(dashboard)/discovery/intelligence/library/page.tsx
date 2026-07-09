import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CampaignIntelligenceLibrary } from "@/features/campaign-intelligence-profile/components/campaign-intelligence-library";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
} from "@/features/discovery/components/discovery-page-identity";

export default function CampaignIntelligenceLibraryPage() {
  const identity = DISCOVERY_PAGE_IDENTITY.intelligence;

  return (
    <DashboardShell title={identity.title} hidePageHeader containedMain mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/intelligence/library" />
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <DiscoveryPageHeader identity={identity} className="mb-4" />
            <Suspense
              fallback={
                <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                  Loading library…
                </div>
              }
            >
              <CampaignIntelligenceLibrary />
            </Suspense>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
