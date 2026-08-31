import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorCalendarView } from "@/features/creator-workspace/components/creator-calendar-view";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { buildCreatorCalendarItems } from "@/features/creator-workspace/calendar";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import { getCreatorCampaigns } from "@/features/portals/queries";

export default async function CreatorPortalCalendarPage() {
  const [campaigns, units] = await Promise.all([getCreatorCampaigns(), loadCreatorUnitViews()]);
  const overlay = overlayCreatorCampaignUnitCounts(campaigns, units);
  const items = buildCreatorCalendarItems({ campaigns: overlay, units });

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorCalendarView items={items} />
    </PlatformErrorBoundary>
  );
}
