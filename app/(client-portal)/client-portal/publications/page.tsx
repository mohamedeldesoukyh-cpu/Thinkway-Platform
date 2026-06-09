import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientPublicationsTable } from "@/features/portals/components/tables/client-publications-table";
import { getClientPublications } from "@/features/portals/queries";

export default async function ClientPortalPublicationsPage() {
  const rows = await getClientPublications();

  return (
    <PlatformErrorBoundary surface="generic">
      <ClientPublicationsTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
