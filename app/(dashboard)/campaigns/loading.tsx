import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignsTableSkeleton } from "@/features/campaigns/components/campaigns-table-skeleton";

export default async function CampaignsLoading() {
  return (
    <DashboardShell
      title="Campaigns"
      description="Plan and manage influencer campaigns across clients and platforms."
    >
      <CampaignsTableSkeleton />
    </DashboardShell>
  );
}
