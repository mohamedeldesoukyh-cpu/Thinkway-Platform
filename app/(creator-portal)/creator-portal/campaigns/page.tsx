import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCampaignsTable } from "@/features/portals/components/tables/creator-campaigns-table";
import { getCreatorCampaigns } from "@/features/portals/queries";

export default async function CreatorPortalCampaignsPage() {
  const rows = await getCreatorCampaigns();

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorCampaignsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
