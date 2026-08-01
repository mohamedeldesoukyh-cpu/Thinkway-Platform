"use client";

import { CampaignCommandCenter } from "@/features/campaigns/components/aurora/campaign-command-center";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";
import type { CampaignPerformanceSummary } from "@/lib/domains/campaign/types";

type CampaignOverviewTabProps = {
  workspace: CampaignWorkspace;
  assignmentHierarchy: AssignmentHierarchy;
  accountManagers: { id: string; full_name: string | null; email: string }[];
  teams: { id: string; name: string }[];
  groups: { id: string; name: string; document_number: string }[];
  currencyOptions: { value: string; label: string }[];
  /** Single lifecycle SSOT from CampaignWorkspaceView — do not recompute. */
  lifecycle: CampaignLifecycleView;
  onOpenDetails?: () => void;
  onNavigateToTab: (tab: CampaignWorkspaceTabId) => void;
  onOpenResolver?: () => void;
  onContinueLifecycle?: () => void;
  performanceSummary?: CampaignPerformanceSummary | null;
  performanceLoaded?: boolean;
};

/** Overview = campaign operating dashboard (command center). */
export function CampaignOverviewTab({
  workspace,
  assignmentHierarchy,
  accountManagers,
  teams: _teams,
  groups: _groups,
  currencyOptions,
  lifecycle,
  onOpenDetails,
  onNavigateToTab,
  onOpenResolver,
  onContinueLifecycle,
  performanceSummary,
  performanceLoaded,
}: CampaignOverviewTabProps) {
  return (
    <CampaignCommandCenter
      workspace={workspace}
      assignmentHierarchy={assignmentHierarchy}
      accountManagers={accountManagers}
      currencyOptions={currencyOptions}
      performanceSummary={performanceSummary}
      performanceLoaded={performanceLoaded}
      onNavigateToTab={onNavigateToTab}
      onOpenDetails={onOpenDetails}
      onOpenResolver={onOpenResolver}
      onContinueLifecycle={onContinueLifecycle}
      lifecycle={lifecycle}
    />
  );
}
