import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VendorsTableSkeleton } from "@/features/vendors/components/vendors-table-skeleton";

export default async function VendorsLoading() {
  return (
    <DashboardShell
      title="Vendors"
      description="Manage creators, agencies, and platform presence for campaign assignments."
    >
      <VendorsTableSkeleton />
    </DashboardShell>
  );
}
