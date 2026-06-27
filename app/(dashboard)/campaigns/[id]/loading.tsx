import { DashboardShell } from "@/components/layout/dashboard-shell";
import { CampaignWorkspaceLoadingSkeleton } from "@/features/campaigns/components/campaign-workspace-loading-skeleton";

export default function CampaignWorkspaceLoading() {
  return (
    <DashboardShell
      title="Campaign workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      <CampaignWorkspaceLoadingSkeleton />
    </DashboardShell>
  );
}
