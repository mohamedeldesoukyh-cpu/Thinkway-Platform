import { Suspense } from "react";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoveryLoadingState } from "@/features/discovery/components/design-system";
import { CreatorCompareWorkspace } from "@/features/discovery/components/creator-compare/creator-compare-workspace";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { getDiscoveryShortlists } from "@/features/discovery/queries";

export default async function CreatorComparePage() {
  const shortlists = await getDiscoveryShortlists();

  return (
    <DiscoveryPageShell
      page="compare"
      variant="flush"
      showHeader={false}
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <Suspense fallback={<DiscoveryLoadingState message="Loading comparison…" />}>
            <CreatorCompareWorkspace shortlists={shortlists} />
          </Suspense>
        </div>
      </PlatformErrorBoundary>
    </DiscoveryPageShell>
  );
}
