"use client";

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignHealthStrip } from "@/features/campaigns/lifecycle/components/campaign-health-strip";
import { CampaignNextActionCard } from "@/features/campaigns/lifecycle/components/campaign-next-action-card";
import { CampaignProcessRail } from "@/features/campaigns/lifecycle/components/campaign-process-rail";
import { CampaignReadinessStrip } from "@/features/campaigns/lifecycle/components/campaign-readiness-strip";
import { CampaignRequirementsPanel } from "@/features/campaigns/lifecycle/components/campaign-requirements-panel";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  /** Currently open workspace tab (navigation) — independent of business stage. */
  activeWorkspaceTab: CampaignWorkspaceTabId;
  onContinue?: () => void;
  onSelectStage?: (tab: CampaignWorkspaceTabId) => void;
  /**
   * full — includes Next Action (standalone surfaces)
   * dashboard — omits hero-duplicated Next Action (used under Campaign Hero)
   */
  variant?: "full" | "dashboard";
  className?: string;
};

/**
 * Lifecycle chrome for Overview — process rail, requirements, readiness, health.
 * Business stage remains source of truth; workspace tab is navigation only.
 */
export function CampaignLifecycleChrome({
  lifecycle,
  activeWorkspaceTab: _activeWorkspaceTab,
  onContinue,
  onSelectStage,
  variant = "full",
  className,
}: Props) {
  return (
    <div className={cn("thinkway-lc-chrome", className)}>
      {variant === "full" ? (
        <CampaignNextActionCard lifecycle={lifecycle} onContinue={onContinue} />
      ) : null}
      <CampaignProcessRail
        lifecycle={lifecycle}
        onSelectStage={onSelectStage}
        density="full"
      />
      <CampaignRequirementsPanel lifecycle={lifecycle} />
      <CampaignReadinessStrip lifecycle={lifecycle} />
      <CampaignHealthStrip lifecycle={lifecycle} />
    </div>
  );
}
