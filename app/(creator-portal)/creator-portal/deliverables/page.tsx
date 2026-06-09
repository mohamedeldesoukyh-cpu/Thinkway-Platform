import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorDeliverablesTable } from "@/features/portals/components/tables/creator-deliverables-table";
import { getCreatorDeliverables } from "@/features/portals/queries";

export default async function CreatorPortalDeliverablesPage() {
  const rows = await getCreatorDeliverables();

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorDeliverablesTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
