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
  rows,
  className,
}: Props) {
  const stats = useMemo(() => {
    const prepared = rows.length;
    const generated = rows.filter((row) => {
      const status = (row.status ?? "").toLowerCase();
      return (
        status === "generated" ||
        status === "ready" ||
        Boolean(row.document_generated_at)
      );
    }).length;
    const sent = rows.filter(
      (row) =>
        Boolean(row.delivered_at) ||
        row.status === "sent" ||
        row.delivery_status === "sent" ||
        row.delivery_status === "completed"
    ).length;
    const approved = rows.filter((row) =>
      row.status === "approved"
    ).length;
    return { prepared, generated, sent, approved };
  }, [rows]);

  return (
    <aside
      className={cn(
        "thinkway-lc-vio-banner",
        className
      )}
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
          <span className="thinkway-bp-label">Delivered</span>
          <strong>{stats.sent}</strong>
        </div>
        <div>
          <span className="thinkway-bp-label">
            Creator approvals
          </span>
          <strong>{stats.approved}</strong>
        </div>
      </div>
        <p className="thinkway-lc-vio-banner-note">
          Delivered includes email and manual delivery. Creator approvals are
          separate from Client IO approval. A Client IO revision does not reset
          recorded deliveries.
        </p>
    </aside>
  );
}
