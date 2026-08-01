"use client";

import type { ReactNode } from "react";

import { CampaignStatusBadge } from "@/features/campaigns/components/campaign-status-badge";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { workspaceLabelForTab } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { CampaignNextActionCard } from "@/features/campaigns/lifecycle/components/campaign-next-action-card";
import { CampaignProcessRail } from "@/features/campaigns/lifecycle/components/campaign-process-rail";
import type { CampaignProcessCue } from "@/features/campaigns/lifecycle/campaign-process-presentation";
import type { CampaignWorkspace } from "@/features/campaigns/types";
import { BusinessProcessStageSummary } from "@/components/workspace/business-process-stage-summary";
import { DocumentNumber } from "@/components/ui/document-number";
import { cn } from "@/lib/utils";

type CampaignHeroProps = {
  workspace: CampaignWorkspace;
  actions: ReactNode;
  processCue?: CampaignProcessCue;
  lifecycle?: CampaignLifecycleView;
  activeWorkspaceTab?: CampaignWorkspaceTabId;
  onNavigateToCurrentStage?: () => void;
  onOpenResolver?: () => void;
  onSelectStage?: (tab: CampaignWorkspaceTabId) => void;
  className?: string;
};

/**
 * Decision-first campaign hero.
 * Identity is compact; Next Action + process rail drive the operating system.
 */
export function CampaignHero({
  workspace,
  actions,
  processCue,
  lifecycle,
  activeWorkspaceTab,
  onNavigateToCurrentStage,
  onOpenResolver,
  onSelectStage,
  className,
}: CampaignHeroProps) {
  const cue = lifecycle?.processCue ?? processCue;
  const workspaceLabel = activeWorkspaceTab
    ? workspaceLabelForTab(activeWorkspaceTab)
    : undefined;
  const identityMeta = [workspace.brand?.name, workspace.client?.name]
    .filter(Boolean)
    .join(" · ");

  return (
    <header
      className={cn(
        "thinkway-aurora-hero",
        lifecycle && "thinkway-aurora-hero-os",
        className
      )}
    >
      <div className="thinkway-aurora-hero-main">
        <div className="thinkway-aurora-hero-line1">
          <span className="thinkway-aurora-serial">
            <DocumentNumber value={workspace.document_number} />
          </span>
          <h1 className="thinkway-aurora-htitle" title={workspace.name}>
            {workspace.name}
          </h1>
          <CampaignStatusBadge
            status={workspace.status}
            className="thinkway-aurora-pill thinkway-aurora-pill-dot shrink-0 normal-case tracking-normal"
          />
        </div>

        {identityMeta ? (
          <div className="thinkway-aurora-hmeta thinkway-aurora-hmeta-compact">
            <b>{identityMeta}</b>
            {lifecycle && workspaceLabel ? (
              <>
                <span className="thinkway-aurora-sep">·</span>
                <span>
                  Viewing <b>{workspaceLabel}</b>
                </span>
              </>
            ) : null}
          </div>
        ) : null}

        {lifecycle ? (
          <>
            <CampaignNextActionCard
              className="mt-3"
              lifecycle={lifecycle}
              onContinue={onNavigateToCurrentStage}
              onOpenResolver={onOpenResolver}
              onNavigateToTab={onSelectStage}
            />
            <CampaignProcessRail
              className="mt-3"
              lifecycle={lifecycle}
              onSelectStage={onSelectStage}
              density="hero"
            />
          </>
        ) : cue ? (
          <BusinessProcessStageSummary
            progress={cue}
            onContinue={onNavigateToCurrentStage}
            workspaceLabel={workspaceLabel}
          />
        ) : null}

        <div className="thinkway-aurora-hactions">{actions}</div>
      </div>
    </header>
  );
}
