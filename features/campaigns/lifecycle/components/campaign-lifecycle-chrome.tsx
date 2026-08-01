"use client";

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignLifecycleDetails } from "@/features/campaigns/lifecycle/components/campaign-lifecycle-details";
import { CampaignNextActionCard } from "@/features/campaigns/lifecycle/components/campaign-next-action-card";
import { CampaignProcessRail } from "@/features/campaigns/lifecycle/components/campaign-process-rail";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  /** Currently open workspace tab (navigation) — independent of business stage. */
  activeWorkspaceTab: CampaignWorkspaceTabId;
  onContinue?: () => void;
  onOpenResolver?: () => void;
  onSelectStage?: (tab: CampaignWorkspaceTabId) => void;
  /**
   * full — includes Next Action / Decision Center (standalone surfaces)
   * dashboard — omits hero-duplicated Next Action (used under Campaign Hero)
   */
  variant?: "full" | "dashboard";
  className?: string;
};

/**
 * Lifecycle chrome for Overview — Decision Center, journey rail, collapsed details.
 * Business stage remains source of truth; workspace tab is navigation only.
 */
export function CampaignLifecycleChrome({
  lifecycle,
  activeWorkspaceTab: _activeWorkspaceTab,
  onContinue,
  onOpenResolver,
  onSelectStage,
  variant = "full",
  className,
}: Props) {
  return (
    <div className={cn("thinkway-lc-chrome", className)}>
      {variant === "full" ? (
        <>
          <CampaignNextActionCard
            lifecycle={lifecycle}
            onContinue={onContinue}
            onOpenResolver={onOpenResolver}
            onNavigateToTab={onSelectStage}
          />
          <CampaignProcessRail
            lifecycle={lifecycle}
            onSelectStage={onSelectStage}
            density="full"
          />
        </>
      ) : null}
      {/* dashboard: Decision Center + Journey live in the Hero — avoid duplicating them here */}
      <CampaignLifecycleDetails lifecycle={lifecycle} />
    </div>
  );
}
