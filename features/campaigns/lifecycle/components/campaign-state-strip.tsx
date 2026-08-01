"use client";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { portfolioIntelFromLifecycle } from "@/features/campaigns/lifecycle/campaign-portfolio-intelligence";
import { DocumentNumber } from "@/components/ui/document-number";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  documentNumber: string;
  campaignName: string;
  workspaceLabel: string;
  updatedAt?: string | null;
  endDate?: string | null;
  onContinue?: () => void;
  className?: string;
};

/**
 * Persistent campaign object strip — stays with process navigation when pinned.
 * Keeps Business Stage / State / Waiting / Next Action continuously visible.
 */
export function CampaignStateStrip({
  lifecycle,
  documentNumber,
  campaignName,
  workspaceLabel,
  updatedAt,
  endDate,
  onContinue,
  className,
}: Props) {
  const intel = portfolioIntelFromLifecycle(lifecycle, { updatedAt, endDate });

  return (
    <div
      className={cn("thinkway-lc-state-strip", className)}
      aria-label="Campaign state"
      data-risk={intel.risk}
    >
      <div className="thinkway-lc-state-strip-identity">
        <span className="thinkway-lc-state-strip-serial">
          <DocumentNumber value={documentNumber} />
        </span>
        <span className="thinkway-lc-state-strip-name" title={campaignName}>
          {campaignName}
        </span>
      </div>

      <div className="thinkway-lc-state-strip-fields">
        <div>
          <span className="thinkway-bp-label">Business Stage</span>
          <strong>{lifecycle.businessStageLabel}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">State</span>
          <strong data-state={lifecycle.businessState}>{lifecycle.businessStateLabel}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Waiting For</span>
          <strong>{intel.waitingFor}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Days Waiting</span>
          <strong>{intel.daysWaitingLabel}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Risk</span>
          <strong data-risk={intel.risk}>{intel.riskLabel}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Workspace</span>
          <strong className="thinkway-lc-state-strip-workspace">{workspaceLabel}</strong>
        </div>
      </div>

      {onContinue ? (
        <button
          type="button"
          className="thinkway-lc-state-strip-cta"
          onClick={onContinue}
          title={lifecycle.reason}
        >
          <span className="thinkway-lc-state-strip-cta-kicker">Next Action</span>
          <span className="thinkway-lc-state-strip-cta-label">{lifecycle.nextAction}</span>
        </button>
      ) : (
        <div className="thinkway-lc-state-strip-cta is-static">
          <span className="thinkway-lc-state-strip-cta-kicker">Next Action</span>
          <span className="thinkway-lc-state-strip-cta-label">{lifecycle.nextAction}</span>
        </div>
      )}
    </div>
  );
}
