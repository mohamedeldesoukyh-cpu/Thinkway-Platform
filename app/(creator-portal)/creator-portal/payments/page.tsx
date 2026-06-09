import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorPaymentsTable } from "@/features/portals/components/tables/creator-payments-table";
import { getCreatorPayments } from "@/features/portals/queries";

export default async function CreatorPortalPaymentsPage() {
  const rows = await getCreatorPayments();

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPaymentsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
