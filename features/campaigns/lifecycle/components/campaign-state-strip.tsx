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
  className?: string;
};

/**
 * Persistent campaign object strip — stage / state / risk only.
 * Decision Center owns Next Action CTAs (no duplicate actions here).
 */
export function CampaignStateStrip({
  lifecycle,
  documentNumber,
  campaignName,
  workspaceLabel,
  updatedAt,
  endDate,
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
          <strong
            data-state={lifecycle.businessState}
            data-severity={lifecycle.decisionCenter.severityMode}
          >
            {lifecycle.businessStateLabel}
          </strong>
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
    </div>
  );
}
