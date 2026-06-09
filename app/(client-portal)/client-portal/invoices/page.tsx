import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ClientInvoicesTable } from "@/features/portals/components/tables/client-invoices-table";
import { getClientInvoices } from "@/features/portals/queries";

export default async function ClientPortalInvoicesPage() {
  const rows = await getClientInvoices();

  return (
    <PlatformErrorBoundary surface="generic">
      <ClientInvoicesTable rows={rows} />
    </PlatformErrorBoundary>
  );
}
