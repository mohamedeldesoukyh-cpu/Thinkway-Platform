"use client";

import type { WorkspaceGuidance } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  guidance: WorkspaceGuidance;
  onContinue?: () => void;
  className?: string;
};

/**
 * Locked-workspace notice only — never duplicates Decision Center / State Strip.
 * In-band tabs render nothing (workspace data first).
 */
export function CampaignWorkspaceGuidance({ guidance, onContinue, className }: Props) {
  const locked = guidance.outOfBand && Boolean(guidance.unlockHint);
  if (!locked && !guidance.currentSituation) return null;

  if (!locked) return null;

  return (
    <aside
      className={cn(
        "thinkway-lc-guidance",
        "is-out-of-band",
        "is-locked",
        className
      )}
      aria-label={`${guidance.workspaceLabel} locked`}
    >
      <div className="thinkway-lc-guidance-kicker">Locked · {guidance.workspaceLabel}</div>
      <div className="thinkway-lc-guidance-compact">
        <div>
          <p className="mt-0.5">{guidance.whatHappened}</p>
          <p className="thinkway-lc-unlock mt-1">{guidance.currentSituation}</p>
        </div>
        {onContinue ? (
          <button type="button" className="thinkway-bp-continue" onClick={onContinue}>
            {guidance.unlockHint ?? guidance.nextAction}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
