"use client";

import type { WorkspaceGuidance } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  guidance: WorkspaceGuidance;
  onContinue?: () => void;
  className?: string;
};

/**
 * Lifecycle summary at the top of every workspace.
 * Business stage remains the source of truth; workspace is the current view.
 */
export function CampaignWorkspaceGuidance({ guidance, onContinue, className }: Props) {
  return (
    <aside
      className={cn(
        "thinkway-lc-guidance",
        guidance.outOfBand && "is-out-of-band",
        className
      )}
      aria-label={`${guidance.workspaceLabel} lifecycle summary`}
    >
      <div className="thinkway-lc-guidance-kicker">
        Same campaign · Business stage remains the source of truth
      </div>
      <div className="thinkway-lc-guidance-head">
        <div>
          <div className="thinkway-bp-label">Business Stage</div>
          <div className="thinkway-lc-guidance-stage">
            {guidance.businessStageLabel}
            <span className="thinkway-lc-pill">{guidance.businessStateLabel}</span>
          </div>
        </div>
        <div>
          <div className="thinkway-bp-label">Workspace view</div>
          <div className="thinkway-lc-guidance-workspace">{guidance.workspaceLabel}</div>
        </div>
        <div>
          <div className="thinkway-bp-label">Requirements</div>
          <div className="thinkway-lc-guidance-workspace">
            {guidance.completedCount} complete · {guidance.missingCount} missing
          </div>
        </div>
      </div>

      <div className="thinkway-lc-guidance-grid">
        <div>
          <div className="thinkway-bp-label">Why this view</div>
          <p>{guidance.whatHappened}</p>
          <p className="thinkway-lc-muted mt-1">{guidance.currentSituation}</p>
          {guidance.unlockHint ? (
            <p className="thinkway-lc-unlock mt-1">{guidance.unlockHint}</p>
          ) : null}
        </div>
        <div>
          <div className="thinkway-bp-label">Next action</div>
          {onContinue ? (
            <button type="button" className="thinkway-bp-continue" onClick={onContinue}>
              {guidance.nextAction}
            </button>
          ) : (
            <p className="font-semibold">{guidance.nextAction}</p>
          )}
          <p className="thinkway-lc-muted mt-1">Owner: {guidance.owner}</p>
        </div>
        <div>
          <div className="thinkway-bp-label">Expected outcome</div>
          <p>{guidance.expectedResult}</p>
        </div>
      </div>
    </aside>
  );
}
