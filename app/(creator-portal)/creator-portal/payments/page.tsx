import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorProfilePayments } from "@/features/creator-workspace/components/creator-profile-payments";
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
      <div className="space-y-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight">Payments</h2>
          <p className="text-sm text-muted-foreground">
            Agreed, invoiced, paid, and pending amounts from your campaign assignments.
          </p>
        </div>
        <CreatorProfilePayments
          rows={payments}
          vendorIos={vendorIos}
          campaigns={overlayed}
        />
      </div>
    </PlatformErrorBoundary>
  );
}
