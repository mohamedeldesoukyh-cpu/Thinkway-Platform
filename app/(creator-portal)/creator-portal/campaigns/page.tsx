import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCampaignCards } from "@/features/creator-workspace/components/creator-campaign-cards";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import { getCreatorCampaigns } from "@/features/portals/queries";

export default async function CreatorPortalCampaignsPage() {
  const [rows, units] = await Promise.all([getCreatorCampaigns(), loadCreatorUnitViews()]);
  const overlay = overlayCreatorCampaignUnitCounts(rows, units);

  return (
    <PlatformErrorBoundary surface="generic">
      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Campaigns</h2>
          <p className="text-sm text-muted-foreground">
            Open a campaign to review your agreement, deliverables, and publications.
          </p>
        </div>
        <CreatorCampaignCards rows={overlay} />
      </div>
    </PlatformErrorBoundary>
  );
}
