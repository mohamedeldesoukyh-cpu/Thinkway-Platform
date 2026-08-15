import type { Metadata } from "next";
import { Suspense } from "react";

import { CreatorSearchWorkspace } from "@/features/discovery/components/creator-search/creator-search-workspace";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { loadCampaignIntelligenceWorkspaceAction } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import { buildDiscoverySearchTaxonomyIndex } from "@/features/discovery/components/creator-search/creator-search-taxonomy";
import {
  getCampaignOptionsForShortlist,
  getDiscoveryShortlists,
} from "@/features/discovery/queries";
import { withTimeBudget } from "@/lib/creators/with-time-budget";
import { getDiscoverySearchTaxonomy } from "@/lib/discovery/search-taxonomy";
import { metadataTitleForEntity } from "@/lib/routing/entity-page";

type PageProps = {
  searchParams: Promise<{ profileId?: string }>;
};

/** Keep first paint off the taxonomy RPC / statement-timeout path. */
const SEARCH_BOOTSTRAP_BUDGET_MS = 1500;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { profileId } = await searchParams;
  const trimmedProfileId = profileId?.trim();
  if (!trimmedProfileId) {
    return { title: "Creator search" };
  }

  const briefState = await loadCampaignIntelligenceWorkspaceAction(trimmedProfileId);
  const profileName = briefState?.profile?.campaignName?.trim();
  if (!profileName) {
    return { title: "Creator search" };
  }

  return {
    title: metadataTitleForEntity({ id: trimmedProfileId, name: profileName }),
  };
}

export default async function CreatorSearchPage({ searchParams }: PageProps) {
  const { profileId } = await searchParams;
  const emptyTaxonomy = buildDiscoverySearchTaxonomyIndex([]);
  const [shortlists, campaigns, taxonomy, initialBriefState] = await Promise.all([
    getDiscoveryShortlists(),
    getCampaignOptionsForShortlist(),
    withTimeBudget(getDiscoverySearchTaxonomy(), SEARCH_BOOTSTRAP_BUDGET_MS, emptyTaxonomy),
    profileId?.trim()
      ? loadCampaignIntelligenceWorkspaceAction(profileId.trim())
      : Promise.resolve(null),
  ]);

  return (
    <DiscoveryPageShell page="search" variant="flush">
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
          searchTaxonomyTerms={[...taxonomy.terms]}
          initialBriefState={initialBriefState}
        />
      </Suspense>
    </DiscoveryPageShell>
  );
}
