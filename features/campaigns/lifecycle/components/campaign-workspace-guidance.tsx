"use client";

import type { ReactNode } from "react";
import type { WorkspaceGuidance } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  guidance: WorkspaceGuidance;
  onContinue?: () => void;
  action?: ReactNode;
  className?: string;
};

/**
 * Workspace restrictions are distinct from follow-up in an earlier stage.
 */
export function CampaignWorkspaceGuidance({ guidance, onContinue, action, className }: Props) {
  const locked = Boolean(guidance.isLocked);
  if (!guidance.outOfBand || !guidance.currentSituation) return null;
  // Completed earlier workspaces do not need a navigation reminder.
  if (!locked && !guidance.unlockHint) return null;

  return (
    <aside
      className={cn(
        "thinkway-lc-guidance",
        "is-out-of-band",
        locked && "is-locked",
        className
      )}
      aria-label={`${guidance.workspaceLabel} ${locked ? "locked" : "follow-up"}`}
    >
      <div className="thinkway-lc-guidance-kicker">{locked ? "Locked" : "Follow-up"} · {guidance.workspaceLabel}</div>
      <div className="thinkway-lc-guidance-compact">
        <div className="thinkway-lc-guidance-copy">
          <strong>{guidance.whatHappened}</strong>{" "}
          <span>{guidance.currentSituation}</span>
        </div>
        {action ?? (onContinue ? (
          <button type="button" className="thinkway-bp-continue" onClick={onContinue}>
            {guidance.unlockHint ?? guidance.nextAction}
          </button>
        ) : null)}
      </div>
    </aside>
  );
}
