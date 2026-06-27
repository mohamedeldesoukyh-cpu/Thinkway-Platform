import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformV6Page } from "@/components/platform/platform-v6-layout";
import { CampaignsTableSkeleton } from "@/features/campaigns/components/campaigns-table-skeleton";

export default async function CampaignsLoading() {
  return (
    <DashboardShell title="Campaigns" platformV6>
      <PlatformV6Page>
        <div className="platform-v6-page-header-row">
          <div className="platform-v6-page-header">
            <h1>Campaigns</h1>
            <p>Plan and manage campaign headers and lines across the brand hierarchy.</p>
          </div>
        </div>
        <CampaignsTableSkeleton />
      </PlatformV6Page>
    </DashboardShell>
  );
}
