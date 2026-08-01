"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  DECISION_SEVERITY_LABEL,
  type DecisionFocusQuery,
  type DecisionSeverity,
} from "@/features/campaigns/lifecycle/campaign-decision-center";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 3;
const DECISION_OPEN_KEY = "thinkway:campaign-decision-center-open";
const DECISION_SEEN_KEY = "thinkway:campaign-decision-center-seen";
const FOCUS_PARAM_KEYS = [
  "io",
  "docsCreator",
  "line",
  "invoice",
  "deliverable",
  "approval",
  "publication",
  "payment",
  "activity",
] as const;

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
 * First visit → expanded (teach the briefing).
 * After first visit → collapsed by default unless user preference was saved.
 */
function readInitialOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const preferred = window.sessionStorage.getItem(DECISION_OPEN_KEY);
    if (preferred === "1") return true;
    if (preferred === "0") return false;
    const seen = window.sessionStorage.getItem(DECISION_SEEN_KEY);
    if (seen === "1") return false;
    return true;
  } catch {
    return true;
  }
}

function severityTone(severity: DecisionSeverity | string): string {
  if (severity === "business_blocker") return "blocker";
  if (severity === "optimization") return "optimization";
  if (severity === "clear" || severity === "progress") return "clear";
  return "attention";
}

/**
 * Executive briefing — one business story with progressive disclosure.
 * Collapsed strip answers stage · progression · waiting · owner · action.
 * Expanded shows the dependency chain; object cards stay lean (no repeated essays).
 */
export function CampaignDecisionCenterPanel({
  lifecycle,
  onPrimaryAction,
  onOpenResolver,
  onNavigateToTab,
  className,
}: Props) {
  const dc = lifecycle.decisionCenter;
  const narrative = dc.narrative;
  const searchParams = useSearchParams();
  const hasDeepLink = FOCUS_PARAM_KEYS.some((key) => Boolean(searchParams.get(key)));
  const [open, setOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const hasBlockers = dc.blockers.length > 0;
  const visible = cardsExpanded
    ? dc.blockers
    : dc.blockers.slice(0, PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, dc.blockers.length - PREVIEW_LIMIT);
  const tone = severityTone(dc.severityMode);
  const severityLabel =
    dc.severityMode === "business_blocker"
      ? DECISION_SEVERITY_LABEL.business_blocker
      : dc.severityMode === "operational_attention" || dc.severityMode === "waiting"
        ? DECISION_SEVERITY_LABEL.operational_attention
        : dc.severityMode === "optimization"
          ? DECISION_SEVERITY_LABEL.optimization
          : "Clear";

  useEffect(() => {
    if (hasDeepLink) {
      setOpen(true);
      setHydrated(true);
      return;
    }
    setOpen(readInitialOpen());
    setHydrated(true);
    try {
      window.sessionStorage.setItem(DECISION_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, [hasDeepLink]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined" || hasDeepLink) return;
    try {
      window.sessionStorage.setItem(DECISION_OPEN_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open, hydrated, hasDeepLink]);

  return (
    <section
      className={cn(
        "thinkway-lc-decision",
        "thinkway-lc-decision-inbox",
        `is-${tone}`,
        !open && "is-collapsed",
        className
      )}
      aria-label="Decision center"
      data-severity={dc.severityMode}
    >
      <button
        type="button"
        className="thinkway-lc-decision-collapse-trigger"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="thinkway-lc-decision-collapse-main">
          <span className="thinkway-lc-decision-kicker">Decision Center</span>
          <span className="thinkway-lc-decision-collapse-stage">
            {narrative.currentStageLabel}
            {narrative.currentStageComplete ? " ✓" : ""}
          </span>
          <span
            className={cn(
              "thinkway-lc-decision-collapse-progression",
              narrative.progressionAllowed ? "is-ok" : "is-blocked"
            )}
          >
            {narrative.progressionAllowed ? "May continue" : "Cannot advance"}
          </span>
          <span className="thinkway-lc-decision-collapse-sep" aria-hidden>
            ·
          </span>
          <span className="thinkway-lc-decision-collapse-waiting">
            {hasBlockers ? narrative.dependencyDetail : "Clear path"}
          </span>
        </div>
        <div className="thinkway-lc-decision-collapse-meta">
          <span
            className={cn("thinkway-lc-decision-severity-chip", `is-${tone}`)}
            data-severity={dc.severityMode}
          >
            {severityLabel}
          </span>
          <span className="thinkway-lc-decision-collapse-owner">
            {narrative.ownerLabel}
          </span>
          <span className="thinkway-lc-decision-collapse-days">
            {narrative.waitingSince}
          </span>
          <span className="thinkway-lc-decision-collapse-icon" aria-hidden>
            {open ? "▼" : "▶"}
          </span>
        </div>
      </button>

      {open ? (
        <div className="thinkway-lc-decision-expanded">
          <div className="thinkway-lc-decision-top">
            <div className="min-w-0">
              <div className="thinkway-lc-decision-headline">
                {narrative.progressionLabel}
              </div>
              <div className="thinkway-lc-decision-subhead">
                {hasBlockers
                  ? `${narrative.dependencyKind}: ${narrative.dependencyDetail}`
                  : dc.clearPathMessage}
              </div>
            </div>
            {hasBlockers && onPrimaryAction ? (
              <button
                type="button"
                className="thinkway-lc-decision-cta"
                onClick={onPrimaryAction}
              >
                <span className="thinkway-lc-decision-cta-label">
                  {narrative.recommendedAction}
                </span>
              </button>
            ) : null}
          </div>

          <ol className="thinkway-lc-decision-chain" aria-label="Dependency chain">
            <li>
              <span className="thinkway-lc-decision-chain-label">Current</span>
              <span className="thinkway-lc-decision-chain-value">
                {narrative.currentStageLabel}
                {narrative.currentStageComplete ? " ✓" : ""}
              </span>
            </li>
            {narrative.nextStageLabel ? (
              <li>
                <span className="thinkway-lc-decision-chain-label">Next</span>
                <span className="thinkway-lc-decision-chain-value">
                  {narrative.nextStageLabel}
                </span>
              </li>
            ) : null}
            <li>
              <span className="thinkway-lc-decision-chain-label">Waiting</span>
              <span className="thinkway-lc-decision-chain-value">
                {narrative.dependencyDetail}
              </span>
            </li>
            <li>
              <span className="thinkway-lc-decision-chain-label">Impact</span>
              <span className="thinkway-lc-decision-chain-value">
                {narrative.businessImpact}
              </span>
            </li>
            <li>
              <span className="thinkway-lc-decision-chain-label">Owner</span>
              <span className="thinkway-lc-decision-chain-value">
                {narrative.ownerLabel} · {narrative.waitingSince}
              </span>
            </li>
            <li>
              <span className="thinkway-lc-decision-chain-label">Then</span>
              <span className="thinkway-lc-decision-chain-value">
                {narrative.unlocksAfter}
              </span>
            </li>
          </ol>

          {hasBlockers ? (
            <div className="thinkway-lc-decision-cards">
              {visible.map((blocker) => (
                <article
                  key={blocker.id}
                  className={cn(
                    "thinkway-lc-decision-card",
                    "is-lean",
                    `is-${severityTone(blocker.severity)}`
                  )}
                  data-severity={blocker.severity}
                >
                  <div className="thinkway-lc-decision-card-kind">
                    {DECISION_SEVERITY_LABEL[blocker.severity]} ·{" "}
                    {blocker.objectLabel}
                  </div>
                  <div className="thinkway-lc-decision-card-title">
                    {blocker.objectRef}
                    {blocker.relatedLabel ? ` · ${blocker.relatedLabel}` : ""}
                  </div>
                  <div className="thinkway-lc-decision-card-lean-meta">
                    {blocker.waitingLabel}
                    <span aria-hidden> · </span>
                    {blocker.owner}
                    <span aria-hidden> · </span>
                    {blocker.sinceLabel}
                  </div>
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
              {hiddenCount > 0 && !cardsExpanded ? (
                <button
                  type="button"
                  className="thinkway-lc-decision-more"
                  onClick={() => setCardsExpanded(true)}
                >
                  +{hiddenCount} additional issue{hiddenCount === 1 ? "" : "s"}
                </button>
              ) : null}
              {cardsExpanded && hiddenCount > 0 ? (
                <button
                  type="button"
                  className="thinkway-lc-decision-more"
                  onClick={() => setCardsExpanded(false)}
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
          ) : null}
        </div>
      ) : (
        <div className="thinkway-lc-decision-collapsed-action">
          {hasBlockers && onPrimaryAction ? (
            <button
              type="button"
              className="thinkway-lc-decision-cta is-compact"
              onClick={(event) => {
                event.stopPropagation();
                onPrimaryAction();
              }}
            >
              <span className="thinkway-lc-decision-cta-label">
                {narrative.recommendedAction}
              </span>
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
