import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCampaignCards } from "@/features/creator-workspace/components/creator-campaign-cards";
import { CreatorPageHeader } from "@/features/creator-workspace/components/creator-workspace-ui";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import { getCreatorCampaigns } from "@/features/portals/queries";

export default async function CreatorPortalCampaignsPage() {
  const [rows, units] = await Promise.all([getCreatorCampaigns(), loadCreatorUnitViews()]);
  const overlay = overlayCreatorCampaignUnitCounts(rows, units);

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPageHeader
        title="Campaigns"
        description="Open a campaign to see the brief, what to deliver, and your fee."
      />
      <CreatorCampaignCards
        rows={overlay}
        emptyDescription="When Thinkway assigns you to a campaign it appears here."
      />
    </PlatformErrorBoundary>
  );
}
