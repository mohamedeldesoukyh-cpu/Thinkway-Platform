"use client";

import type { DecisionFocusQuery } from "@/features/campaigns/lifecycle/campaign-decision-center";
import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { CampaignWorkspaceTabId } from "@/features/campaigns/constants/campaign-workspace-tab-order";
import {
  DetailPanelHeader,
  DetailPill,
  OperationalDetailSheet,
} from "@/features/campaigns/components/operational-detail-panel";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lifecycle: CampaignLifecycleView;
  onResolveAction: (
    tab: CampaignWorkspaceTabId,
    focus?: DecisionFocusQuery | null
  ) => void;
};

/**
 * Smart Blocker Resolver — object drill-down console.
 * Wrong → why → object → open → fix → continue.
 */
export function CampaignBlockerResolverDrawer({
  open,
  onOpenChange,
  lifecycle,
  onResolveAction,
}: Props) {
  const dc = lifecycle.decisionCenter;
  const severityLabel =
    dc.severityMode === "hard"
      ? "Hard Block"
      : dc.severityMode === "attention" || dc.severityMode === "waiting"
        ? "Needs Attention"
        : "Clear";

  return (
    <OperationalDetailSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Operational Items"
      description={`${dc.headline}. Open the exact record to resolve.`}
    >
      <DetailPanelHeader
        breadcrumb={
          <>
            {lifecycle.businessStageLabel}
            <span className="text-muted-foreground/60"> / </span>
            {lifecycle.businessStateLabel}
          </>
        }
        avatarInitials="DC"
        title="Operational Items"
        subtitle={dc.headline}
        badges={<DetailPill>{severityLabel}</DetailPill>}
      />

      <div className="thinkway-lc-resolver-body flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
        {dc.blockers.length === 0 ? (
          <div className="thinkway-lc-decision-clear" role="status">
            {dc.clearPathMessage}
            <button
              type="button"
              className="thinkway-lc-resolver-action mt-3"
              onClick={() => {
                onResolveAction(dc.primaryActionTab, dc.primaryFocusQuery);
                onOpenChange(false);
              }}
            >
              {dc.primaryAction}
            </button>
          </div>
        ) : (
          <ul className="thinkway-lc-resolver-list">
            {dc.blockers.map((blocker, index) => (
              <li
                key={blocker.id}
                className={cn(
                  "thinkway-lc-resolver-item",
                  blocker.severity === "hard" && "is-hard"
                )}
              >
                <div className="thinkway-lc-resolver-item-top">
                  <div className="thinkway-lc-resolver-index">#{index + 1}</div>
                  <div>
                    <div className="thinkway-lc-resolver-title">
                      {blocker.objectLabel} {blocker.objectRef}
                    </div>
                    <div className="thinkway-lc-muted">{blocker.title}</div>
                  </div>
                </div>

                <dl className="thinkway-lc-resolver-meta">
                  <div>
                    <dt>Waiting for</dt>
                    <dd>{blocker.waitingLabel}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{blocker.owner}</dd>
                  </div>
                  <div>
                    <dt>Since</dt>
                    <dd>{blocker.sinceLabel}</dd>
                  </div>
                  {blocker.relatedLabel ? (
                    <div>
                      <dt>Creator</dt>
                      <dd>{blocker.relatedLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                <p className="thinkway-lc-resolver-why">
                  <span className="thinkway-bp-label">Why</span>
                  {blocker.reason}
                </p>
                <p className="thinkway-lc-resolver-why">
                  <span className="thinkway-bp-label">Impact</span>
                  {blocker.impact}
                </p>
                <p className="thinkway-lc-resolver-why">
                  <span className="thinkway-bp-label">Unlock</span>
                  {blocker.unlockLabel}
                </p>

                <button
                  type="button"
                  className="thinkway-lc-resolver-action"
                  onClick={() => {
                    onResolveAction(blocker.actionTab, blocker.focusQuery);
                    onOpenChange(false);
                  }}
                >
                  {blocker.primaryAction}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </OperationalDetailSheet>
  );
}
