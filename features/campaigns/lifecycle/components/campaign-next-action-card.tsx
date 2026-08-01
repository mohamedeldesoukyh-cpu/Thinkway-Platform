"use client";

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignDecisionCenterPanel } from "@/features/campaigns/lifecycle/components/campaign-decision-center-panel";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  onContinue?: () => void;
  onOpenResolver?: () => void;
  onNavigateToTab?: (tab: CampaignWorkspaceTabId) => void;
  className?: string;
};

/** Primary operating-system CTA — Decision Center is the default journey. */
export function CampaignNextActionCard({
  lifecycle,
  onContinue,
  onOpenResolver,
  onNavigateToTab,
  className,
}: Props) {
  return (
    <CampaignDecisionCenterPanel
      className={cn(className)}
      lifecycle={lifecycle}
      onPrimaryAction={onContinue}
      onOpenResolver={onOpenResolver}
      onNavigateToTab={onNavigateToTab}
    />
  );
}
