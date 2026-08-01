"use client";

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignLifecycleDetails } from "@/features/campaigns/lifecycle/components/campaign-lifecycle-details";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  /** Currently open workspace tab (navigation) — independent of business stage. */
  activeWorkspaceTab: CampaignWorkspaceTabId;
  onContinue?: () => void;
  onOpenResolver?: () => void;
  onSelectStage?: (tab: CampaignWorkspaceTabId) => void;
  /**
   * full — legacy standalone (unused in hero path)
   * dashboard — Overview under Hero; Decision Center lives in Hero only
   */
  variant?: "full" | "dashboard";
  className?: string;
};

/**
 * Overview secondary chrome — collapsed Lifecycle Details only.
 * Decision Center + State Strip own operating posture (no duplicates).
 */
export function CampaignLifecycleChrome({
  lifecycle,
  activeWorkspaceTab: _activeWorkspaceTab,
  onSelectStage,
  className,
}: Props) {
  return (
    <div className={cn("thinkway-lc-chrome", className)}>
      <CampaignLifecycleDetails
        lifecycle={lifecycle}
        onSelectStage={onSelectStage}
      />
    </div>
  );
}
