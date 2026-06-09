import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientReportsTable } from "@/features/portals/components/tables/client-reports-table";
import { getClientReports } from "@/features/portals/queries";

export default async function ClientPortalReportsPage() {
  const rows = await getClientReports();

  return (
    <PlatformErrorBoundary surface="generic">
      <ClientReportsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
