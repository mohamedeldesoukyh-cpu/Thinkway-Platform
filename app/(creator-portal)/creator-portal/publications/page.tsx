import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorPublicationsTable } from "@/features/portals/components/tables/creator-publications-table";
import { getCreatorPublications } from "@/features/portals/queries";

export default async function CreatorPortalPublicationsPage() {
  const rows = await getCreatorPublications();

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorPublicationsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
