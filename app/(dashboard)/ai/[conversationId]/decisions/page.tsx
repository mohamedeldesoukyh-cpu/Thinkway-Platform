import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";

import { CampaignIntelligenceShell } from "@/features/campaign-decision-workspace/components/campaign-intelligence-shell";

type DecisionsPageProps = {
  params: Promise<{ conversationId: string }>;
};

export default async function CampaignDecisionsPage({ params }: DecisionsPageProps) {
  const { conversationId } = await params;

  return (
    <DashboardShell
      title="Decision Workspace"
      hidePageHeader
      containedMain
      mainClassName="min-h-0 flex-1 flex-col overflow-hidden p-0 md:p-0"
    >
      <PlatformErrorBoundary surface="analytics">
        <CampaignIntelligenceShell conversationId={conversationId} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
