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

      headerActions={

        <Button

          variant="outline"

          size="sm"

          className="h-9 gap-[7px] px-3.5 text-[12.5px] font-bold text-[var(--text-2)]"

          asChild

        >

          <Link href="/discovery/search">

            <SearchIcon className="size-3.5" />

            Creator Search

          </Link>

        </Button>

      }

    >

      <Suspense fallback={<DiscoveryLoadingState message="Loading library…" />}>

        <CampaignIntelligenceLibrary />

      </Suspense>

    </DiscoveryPageShell>

  );

}

