import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceLoadingSkeleton } from "@/features/campaigns/components/campaign-workspace-loading-skeleton";

export default function CampaignWorkspaceLoading() {
  return (
    <DashboardShell
      title="Campaign workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col p-3 md:px-6 md:py-4"
    >
      <CampaignWorkspaceLoadingSkeleton />
    </DashboardShell>
  );
}
