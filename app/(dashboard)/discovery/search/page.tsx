import type { Metadata } from "next";
import { Suspense } from "react";

import { ThinkwayRouteLoading } from "@/components/layout/thinkway-page-loader";
import { CreatorSearchWorkspace } from "@/features/discovery/components/creator-search/creator-search-workspace";
import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { loadCampaignIntelligenceWorkspaceAction } from "@/features/campaign-intelligence-profile/actions/profile-actions";
import { metadataTitleForEntity } from "@/lib/routing/entity-page";

type PageProps = {
  searchParams: Promise<{ profileId?: string }>;
};

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
  const initialBriefState = profileId?.trim()
    ? await loadCampaignIntelligenceWorkspaceAction(profileId.trim())
    : null;

  return (
    <DiscoveryPageShell page="search" variant="flush">
      <Suspense fallback={<ThinkwayRouteLoading />}>
        <CreatorSearchWorkspace
          shortlists={[]}
          campaigns={[]}
          searchTaxonomyTerms={[]}
          initialBriefState={initialBriefState}
        />
      </Suspense>
    </DiscoveryPageShell>
  );
}
