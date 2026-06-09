import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientCampaignsTable } from "@/features/portals/components/tables/client-campaigns-table";
import { getClientCampaigns } from "@/features/portals/queries";

export default async function ClientPortalCampaignsPage() {
  const rows = await getClientCampaigns();

  return (
    <PlatformErrorBoundary surface="generic">
      <ClientCampaignsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
