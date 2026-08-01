"use client";

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
  onResolveAction: (tab: CampaignWorkspaceTabId) => void;
};

/**
 * Smart Blocker Resolver — action console (OperationalDetailSheet).
 * Each blocker is an executable work item, not a text list.
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
      title="Smart Blocker Resolver"
      description={`${dc.headline}. Resolve items without leaving this workspace.`}
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
        title="Smart Blocker Resolver"
        subtitle={dc.headline}
        badges={<DetailPill>{severityLabel}</DetailPill>}
      />

      <div className="thinkway-lc-resolver-body flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-6">
        <div className="thinkway-lc-resolver-banner" data-severity={dc.severityMode}>
          <div className="thinkway-bp-label">Why can&apos;t I continue?</div>
          <p>{dc.continueReason}</p>
          <p className="thinkway-lc-muted mt-1">
            Owner <b>{lifecycle.owner}</b>
            {lifecycle.waitingFor !== "None" ? (
              <>
                {" "}
                · Waiting <b>{lifecycle.waitingFor}</b>
              </>
            ) : null}
            {" · "}
            Next action <b>{dc.primaryAction}</b>
          </p>
        </div>

        {dc.blockers.length === 0 ? (
          <div className="thinkway-lc-decision-clear" role="status">
            {dc.clearPathMessage}
            <button
              type="button"
              className="thinkway-lc-resolver-action mt-3"
              onClick={() => {
                onResolveAction(dc.primaryActionTab);
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
                    <div
                      className="thinkway-lc-resolver-severity"
                      data-severity={blocker.severity}
                    >
                      {blocker.severity === "hard" ? "Hard Block" : "Needs Attention"}
                    </div>
                    <div className="thinkway-lc-resolver-title">{blocker.title}</div>
                  </div>
                </div>

                <dl className="thinkway-lc-resolver-meta">
                  <div>
                    <dt>Status</dt>
                    <dd>{blocker.severity === "hard" ? "Hard Block" : "Needs Attention"}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd>{blocker.owner}</dd>
                  </div>
                  <div>
                    <dt>Waiting for</dt>
                    <dd>{blocker.waitingFor}</dd>
                  </div>
                  <div>
                    <dt>Waiting time</dt>
                    <dd>{blocker.sinceLabel}</dd>
                  </div>
                  {blocker.relatedLabel ? (
                    <div>
                      <dt>Related</dt>
                      <dd>{blocker.relatedLabel}</dd>
                    </div>
                  ) : null}
                </dl>

                <p className="thinkway-lc-resolver-why">
                  <span className="thinkway-bp-label">Why</span>
                  {blocker.whyBlocks}
                </p>
                <p className="thinkway-lc-resolver-why">
                  <span className="thinkway-bp-label">Expected result</span>
                  {blocker.expectedResult}
                </p>

                <button
                  type="button"
                  className="thinkway-lc-resolver-action"
                  onClick={() => {
                    onResolveAction(blocker.actionTab);
                    onOpenChange(false);
                  }}
                >
                  {blocker.primaryAction}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="thinkway-lc-resolver-unlock">
          <div className="thinkway-bp-label">{dc.unlockHeadline}</div>
          <ul>
            {dc.unlocks.map((item) => (
              <li key={item.id}>
                <span aria-hidden>✓</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </OperationalDetailSheet>
  );
}
