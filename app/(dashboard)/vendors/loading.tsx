import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page } from "@/components/platform/platform-v6-layout";
import { VendorsTableSkeleton } from "@/features/vendors/components/vendors-table-skeleton";

export default async function VendorsLoading() {
  return (
    <DashboardShell title="Vendors" platformV6>
      <PlatformV6Page>
        <div className="platform-v6-page-header-row">
          <div className="platform-v6-page-header">
            <h1>Vendors</h1>
            <p>Manage creators, agencies, and platform presence for campaign assignments.</p>
          </div>
        </div>
        <VendorsTableSkeleton />
      </PlatformV6Page>
    </DashboardShell>
  );
}
