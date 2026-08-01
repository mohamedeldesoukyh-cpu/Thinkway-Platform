"use client";

import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  onPrimaryAction?: () => void;
  onOpenResolver?: () => void;
  onNavigateToTab?: (tab: CampaignWorkspaceTabId) => void;
  className?: string;
};

/**
 * Decision-first lifecycle header — answers where / why / who / what / unlocks.
 * Content is derived from lifecycle.decisionCenter (single SSOT).
 */
export function CampaignDecisionCenterPanel({
  lifecycle,
  onPrimaryAction,
  onOpenResolver,
  onNavigateToTab,
  className,
}: Props) {
  const dc = lifecycle.decisionCenter;
  const preview = dc.blockers.slice(0, 2);
  const hasBlockers = dc.blockers.length > 0;

  return (
    <section
      className={cn(
        "thinkway-lc-decision",
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
          <div className="thinkway-lc-decision-meta-row">
            <span className="thinkway-lc-decision-severity" data-severity={dc.severityMode}>
              {dc.severityMode === "hard"
                ? "Hard Block"
                : dc.severityMode === "attention"
                  ? "Needs Attention"
                  : dc.severityMode === "waiting"
                    ? "Waiting"
                    : dc.severityMode === "clear"
                      ? "Clear"
                      : "In Progress"}
            </span>
            <span className="thinkway-lc-decision-ssot">
              Stage <b>{lifecycle.businessStageLabel}</b>
              {" · "}
              Owner <b>{lifecycle.owner}</b>
              {lifecycle.waitingFor !== "None" ? (
                <>
                  {" · "}
                  Waiting <b>{lifecycle.waitingFor}</b>
                </>
              ) : null}
            </span>
          </div>
        </div>
        {onPrimaryAction ? (
          <button
            type="button"
            className="thinkway-lc-decision-cta"
            onClick={onPrimaryAction}
          >
            <span className="thinkway-lc-decision-cta-kicker">Next action</span>
            <span className="thinkway-lc-decision-cta-label">{dc.primaryAction}</span>
          </button>
        ) : null}
      </div>

      <div className="thinkway-lc-decision-grid">
        <div>
          <div className="thinkway-bp-label">
            {hasBlockers ? "Why can't I continue?" : "Status"}
          </div>
          <p>{dc.continueReason}</p>
          {dc.remainingBlockerLabels.length > 1 ? (
            <ul className="thinkway-lc-decision-remaining">
              {dc.remainingBlockerLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <div className="thinkway-bp-label">What will unlock?</div>
          <p className="thinkway-lc-decision-unlock-head">{dc.unlockHeadline}</p>
          <ul className="thinkway-lc-decision-unlocks">
            {dc.unlocks.map((item) => (
              <li key={item.id}>
                <span aria-hidden>✓</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {hasBlockers ? (
        <div className="thinkway-lc-decision-cards">
          {preview.map((blocker) => (
            <article
              key={blocker.id}
              className="thinkway-lc-decision-card"
              data-severity={blocker.severity}
            >
              <div className="thinkway-lc-decision-card-title">{blocker.title}</div>
              <div className="thinkway-lc-decision-card-meta">
                <span data-severity={blocker.severity}>
                  {blocker.severity === "hard" ? "Hard Block" : "Needs Attention"}
                </span>
                <span>
                  Owner <b>{blocker.owner}</b>
                </span>
                <span>
                  Waiting <b>{blocker.waitingFor}</b>
                </span>
                <span>
                  Since <b>{blocker.sinceLabel}</b>
                </span>
                {blocker.relatedLabel ? (
                  <span>
                    <b>{blocker.relatedLabel}</b>
                  </span>
                ) : null}
              </div>
              <p className="thinkway-lc-decision-card-why">{blocker.whyBlocks}</p>
              {onNavigateToTab ? (
                <button
                  type="button"
                  className="thinkway-lc-decision-card-action is-button"
                  onClick={() => onNavigateToTab(blocker.actionTab)}
                >
                  {blocker.primaryAction}
                </button>
              ) : (
                <div className="thinkway-lc-decision-card-action">{blocker.primaryAction}</div>
              )}
            </article>
          ))}
          {dc.blockers.length > 0 && onOpenResolver ? (
            <button
              type="button"
              className="thinkway-lc-decision-more"
              onClick={onOpenResolver}
            >
              {dc.blockers.length > 2
                ? `Open resolver · ${dc.blockers.length} blockers`
                : "Open Smart Blocker Resolver"}
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
