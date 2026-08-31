import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorProfilePayments } from "@/features/creator-workspace/components/creator-profile-payments";
import { CreatorPageHeader } from "@/features/creator-workspace/components/creator-workspace-ui";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import { getCreatorCampaigns, getCreatorPayments, getCreatorVendorIos } from "@/features/portals/queries";

export default async function CreatorPortalPaymentsPage() {
  const [payments, campaigns, units, vendorIos] = await Promise.all([
    getCreatorPayments(),
    getCreatorCampaigns(),
    loadCreatorUnitViews(),
    getCreatorVendorIos(),
  ]);
  const overlayed = overlayCreatorCampaignUnitCounts(campaigns, units);

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPageHeader
        title="Payments"
        description="Agreed, invoiced, paid and pending amounts from your campaign assignments."
      />
      <CreatorProfilePayments
        rows={payments}
        vendorIos={vendorIos}
        campaigns={overlayed}
      />
    </PlatformErrorBoundary>
  );
}
