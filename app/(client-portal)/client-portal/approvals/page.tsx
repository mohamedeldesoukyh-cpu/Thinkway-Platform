import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientApprovalsTable } from "@/features/portals/components/tables/client-approvals-table";
import { getClientApprovals } from "@/features/portals/queries";

export default async function ClientPortalApprovalsPage() {
  const rows = await getClientApprovals();

  return (
    <PlatformErrorBoundary surface="generic">
      <ClientApprovalsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
