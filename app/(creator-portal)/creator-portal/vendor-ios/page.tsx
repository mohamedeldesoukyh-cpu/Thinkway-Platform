import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorVendorIosTable } from "@/features/portals/components/tables/creator-vendor-ios-table";
import { getCreatorVendorIos } from "@/features/portals/queries";

export default async function CreatorPortalVendorIosPage() {
  const rows = await getCreatorVendorIos();

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorVendorIosTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
