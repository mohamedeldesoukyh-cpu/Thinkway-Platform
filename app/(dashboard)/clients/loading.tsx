import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ClientsTableSkeleton } from "@/features/clients/components/clients-table-skeleton";

export default function ClientsLoading() {
  return (
    <DashboardShell
      title="Clients"
      description="Manage brand accounts, billing details, and client relationships."
    >
      <ClientsTableSkeleton />
    </DashboardShell>
  );
}
