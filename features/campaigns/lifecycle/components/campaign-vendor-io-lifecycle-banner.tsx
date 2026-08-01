"use client";

import { useMemo } from "react";

import type { CampaignLifecycleView } from "@/features/campaigns/lifecycle/campaign-lifecycle-orchestrator";
import type { VendorIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

type Props = {
  lifecycle: CampaignLifecycleView;
  rows: VendorIoRow[];
  className?: string;
};

/**
 * Compact Vendor IO readiness stats only.
 * When Client approval blocks send, Decision Center owns the single narrative —
 * this banner must not restate the same blocker.
 */
export function CampaignVendorIoLifecycleBanner({
  lifecycle,
  rows,
  className,
}: Props) {
  const stats = useMemo(() => {
    const prepared = rows.length;
    const generated = rows.filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      return (
        status === "draft" ||
        status === "generated" ||
        status === "ready" ||
        Boolean(row.document_generated_at)
      );
    }).length;
    const sent = rows.filter(
      (row) =>
        row.status === "sent" ||
        row.delivery_status === "sent" ||
        row.delivery_status === "completed"
    ).length;
    const approved = rows.filter((row) =>
      (row.status ?? "").toLowerCase().includes("approv")
    ).length;
    return { prepared, generated, sent, approved };
  }, [rows]);

  const waitingClient =
    lifecycle.businessStageId === "client-io" ||
    lifecycle.processCue.stageSignals["client-io"] !== "completed";

  return (
    <aside
      className={cn("thinkway-lc-vio-banner", waitingClient && "is-blocked", className)}
      aria-label="Vendor IO summary"
    >
      <div className="thinkway-lc-vio-stats">
        <div>
          <span className="thinkway-bp-label">Vendor IOs</span>
          <strong>{stats.prepared}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Generated</span>
          <strong>{stats.generated}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">Sent</span>
          <strong>{waitingClient ? 0 : stats.sent}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">
            {waitingClient ? "Waiting Client Approval" : "Approved"}
          </span>
          <strong>{waitingClient ? stats.prepared : stats.approved}</strong>
        </div>
      </div>
    </aside>
  );
}
