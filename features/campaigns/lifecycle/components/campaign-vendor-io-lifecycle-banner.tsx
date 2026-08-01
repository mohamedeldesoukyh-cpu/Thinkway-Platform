"use client";

import { useMemo } from "react";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { VendorIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  rows: VendorIoRow[];
  onOpenClientIo?: () => void;
  className?: string;
};

/**
 * Separates prepared Vendor IO data from lifecycle send-readiness.
 * Drafts can exist while Client approval still blocks send.
 */
export function CampaignVendorIoLifecycleBanner({
  lifecycle,
  rows,
  onOpenClientIo,
  className,
}: Props) {
  const stats = useMemo(() => {
    const prepared = rows.length;
    const readyToSend = rows.filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      return status === "draft" || status === "generated" || status === "ready";
    }).length;
    const approved = rows.filter((row) =>
      (row.status ?? "").toLowerCase().includes("approv")
    ).length;
    return { prepared, readyToSend, approved };
  }, [rows]);

  const waitingClient =
    lifecycle.businessStageId === "client-io" ||
    lifecycle.processCue.stageSignals["client-io"] !== "completed";

  return (
    <aside
      className={cn("thinkway-lc-vio-banner", waitingClient && "is-blocked", className)}
      aria-label="Vendor IO lifecycle status"
    >
      <div className="thinkway-lc-vio-stats">
        <div>
          <span className="thinkway-bp-label">Prepared Drafts</span>
          <strong>{stats.prepared}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Ready to Send</span>
          <strong>{waitingClient ? 0 : stats.readyToSend}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Approved</span>
          <strong>{stats.approved}</strong>
        </div>
      </div>

      {waitingClient ? (
        <div className="thinkway-lc-vio-blocked">
          <div className="thinkway-bp-label">Blocked</div>
          <p>Complete Client IO to unlock Vendor IO send.</p>
          <p className="thinkway-lc-muted">
            Prepared drafts can exist now — send unlocks after Client approval.
          </p>
          {onOpenClientIo ? (
            <button
              type="button"
              className="thinkway-bp-continue mt-2"
              onClick={onOpenClientIo}
            >
              Open Client IO
            </button>
          ) : null}
        </div>
      ) : (
        <div className="thinkway-lc-vio-blocked is-clear">
          <div className="thinkway-bp-label">Ready</div>
          <p>Client approval received. Issue and send Vendor IO.</p>
        </div>
      )}
    </aside>
  );
}
