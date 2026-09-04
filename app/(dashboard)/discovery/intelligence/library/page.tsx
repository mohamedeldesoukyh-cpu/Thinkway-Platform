import { Suspense } from "react";
import Link from "next/link";
import { SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CampaignIntelligenceLibrary } from "@/features/campaign-intelligence-profile/components/campaign-intelligence-library";
import { DiscoveryLoadingState } from "@/features/discovery/components/design-system";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";

export default function CampaignIntelligenceLibraryPage() {
  return (
    <DiscoveryPageShell
      page="intelligence"
      activeHref="/discovery/intelligence/library"
      showHeader={false}
    >
      <Suspense fallback={<DiscoveryLoadingState message="Loading library…" />}>
        <CampaignIntelligenceLibrary
          headerAction={
            <Button
              size="sm"
              className="h-8 gap-1.5 rounded-[8px] px-3 text-[12px] font-semibold"
              asChild
            >
              <Link href="/discovery/search">
                <SearchIcon className="size-3.5" />
                Creator Search
              </Link>
            </Button>
          }
        />
      </Suspense>
    </DiscoveryPageShell>
  );
}
