"use client";

import type { WorkspaceGuidance } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  guidance: WorkspaceGuidance;
  onContinue?: () => void;
  className?: string;
};

/**
 * Compact lifecycle-aware workspace banner.
 * Locked / out-of-band views explain why — never a generic loading substitute.
 * Business Stage / Next Action remain in the lifecycle header (State Strip).
 */
export function CampaignWorkspaceGuidance({ guidance, onContinue, className }: Props) {
  const locked = guidance.outOfBand && Boolean(guidance.unlockHint);

  return (
    <aside
      className={cn(
        "thinkway-lc-guidance",
        guidance.outOfBand && "is-out-of-band",
        locked && "is-locked",
        className
      )}
      aria-label={`${guidance.workspaceLabel} lifecycle summary`}
    >
      <div className="thinkway-lc-guidance-kicker">
        {locked ? "Locked workspace" : "Workspace context"}
        {" · "}
        Business stage: {guidance.businessStageLabel}
      </div>

      <div className="thinkway-lc-guidance-compact">
        <div>
          <div className="thinkway-lc-guidance-workspace">
            {guidance.workspaceLabel}
            {locked ? (
              <span className="thinkway-lc-pill ml-1.5" data-state="needs_attention">
                Locked
              </span>
            ) : (
              <span className="thinkway-lc-pill ml-1.5">{guidance.businessStateLabel}</span>
            )}
          </div>
          <p className="mt-1">{guidance.currentSituation}</p>
          {guidance.unlockHint ? (
            <p className="thinkway-lc-unlock mt-1">{guidance.unlockHint}</p>
          ) : (
            <p className="thinkway-lc-muted mt-1">{guidance.whatHappened}</p>
          )}
        </div>

        {onContinue ? (
          <button type="button" className="thinkway-bp-continue" onClick={onContinue}>
            {guidance.nextAction}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
