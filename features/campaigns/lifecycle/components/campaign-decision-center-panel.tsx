"use client";

import { useState } from "react";

import type { DecisionFocusQuery } from "@/features/campaigns/lifecycle/campaign-decision-center";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 3;

type Props = {
  lifecycle: CampaignLifecycleView;
  onPrimaryAction?: () => void;
  onOpenResolver?: () => void;
  onNavigateToTab?: (
    tab: CampaignWorkspaceTabId,
    focus?: DecisionFocusQuery | null
  ) => void;
  className?: string;
};

/**
 * Operational inbox — answers what / why / who / since / waiting / impact / action / unlock.
 * Many objects collapse into summary cards; never dump dozens of rows here.
 */
export function CampaignDecisionCenterPanel({
  lifecycle,
  onPrimaryAction,
  onOpenResolver,
  onNavigateToTab,
  className,
}: Props) {
  const dc = lifecycle.decisionCenter;
  const [expanded, setExpanded] = useState(false);
  const hasBlockers = dc.blockers.length > 0;
  const visible = expanded
    ? dc.blockers
    : dc.blockers.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, dc.blockers.length - PREVIEW_LIMIT);

  return (
    <section
      className={cn(
        "thinkway-lc-decision",
        "thinkway-lc-decision-inbox",
        `is-${dc.severityMode}`,
        className
      )}
      aria-label="Decision center"
      data-severity={dc.severityMode}
    >
      <div className="thinkway-lc-decision-top">
        <div className="min-w-0">
          <div className="thinkway-lc-decision-kicker">Decision Center</div>
          <div className="thinkway-lc-decision-headline">{dc.headline}</div>
        </div>
        {hasBlockers && onPrimaryAction ? (
          <button
            type="button"
            className="thinkway-lc-decision-cta"
            onClick={onPrimaryAction}
          >
            <span className="thinkway-lc-decision-cta-label">{dc.primaryAction}</span>
          </button>
        ) : null}
      </div>

      {hasBlockers ? (
        <div className="thinkway-lc-decision-cards">
          {visible.map((blocker) => (
            <article
              key={blocker.id}
              className="thinkway-lc-decision-card"
              data-severity={blocker.severity}
            >
              <div className="thinkway-lc-decision-card-kind">{blocker.objectLabel}</div>
              <div className="thinkway-lc-decision-card-title">
                {blocker.title}
              </div>
              <dl className="thinkway-lc-decision-card-facts">
                <div>
                  <dt>Waiting for</dt>
                  <dd>{blocker.waitingLabel}</dd>
                </div>
                <div>
                  <dt>{blocker.objectKind === "vendor_io" ? "Vendor IO" : "Object"}</dt>
                  <dd>{blocker.objectRef}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{blocker.owner}</dd>
                </div>
                <div>
                  <dt>Since</dt>
                  <dd>{blocker.sinceLabel}</dd>
                </div>
                <div className="thinkway-lc-decision-card-span">
                  <dt>Reason</dt>
                  <dd>{blocker.reason}</dd>
                </div>
                <div className="thinkway-lc-decision-card-span">
                  <dt>Impact</dt>
                  <dd>{blocker.impact}</dd>
                </div>
                <div className="thinkway-lc-decision-card-span">
                  <dt>Unlock</dt>
                  <dd>{blocker.unlockLabel}</dd>
                </div>
              </dl>
              {onNavigateToTab ? (
                <button
                  type="button"
                  className="thinkway-lc-decision-card-action is-button"
                  onClick={() =>
                    onNavigateToTab(blocker.actionTab, blocker.focusQuery)
                  }
                >
                  {blocker.primaryAction}
                </button>
              ) : (
                <div className="thinkway-lc-decision-card-action">
                  {blocker.primaryAction}
                </div>
              )}
            </article>
          ))}
          {hiddenCount > 0 && !expanded ? (
            <button
              type="button"
              className="thinkway-lc-decision-more"
              onClick={() => setExpanded(true)}
            >
              +{hiddenCount} additional issue{hiddenCount === 1 ? "" : "s"}
            </button>
          ) : null}
          {expanded && hiddenCount > 0 ? (
            <button
              type="button"
              className="thinkway-lc-decision-more"
              onClick={() => setExpanded(false)}
            >
              Show fewer
            </button>
          ) : null}
          {dc.blockers.length > 0 && onOpenResolver ? (
            <button
              type="button"
              className="thinkway-lc-decision-more is-secondary"
              onClick={onOpenResolver}
            >
              Open resolver
            </button>
          ) : null}
        </div>
      ) : (
        <div className="thinkway-lc-decision-clear" role="status">
          {dc.clearPathMessage}
        </div>
      )}
    </section>
  );
}
