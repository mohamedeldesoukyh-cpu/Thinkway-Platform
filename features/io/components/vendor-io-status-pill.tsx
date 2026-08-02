"use client";

import {
  resolveVendorIoLifecycle,
  vendorIoRowToLifecycleSnapshot,
} from "@/lib/document-lifecycle";
import type { VendorIoRow } from "@/features/io/types";
import { cn } from "@/lib/utils";

const STATE_CLASS: Record<string, string> = {
  draft: "thinkway-campaign-badge-gray",
  pending_send: "thinkway-campaign-badge-gray",
  sent: "thinkway-campaign-badge-blue",
  delivered_manually: "thinkway-campaign-badge-blue",
  viewed: "thinkway-campaign-badge-blue",
  accepted: "thinkway-campaign-badge-green",
  rejected: "thinkway-campaign-badge-red",
  revision_required: "thinkway-campaign-badge-amber",
  superseded: "thinkway-campaign-badge-gray",
  cancelled: "thinkway-campaign-badge-red",
  archived: "thinkway-campaign-badge-gray",
};

type Props = {
  status?: VendorIoRow["status"];
  row?: Pick<
    VendorIoRow,
    | "id"
    | "status"
    | "delivery_method"
    | "delivery_status"
    | "sent_at"
    | "approved_at"
    | "attachment_url"
    | "amount"
    | "currency_code"
  > & {
    is_superseded?: boolean | null;
    lifecycle_reason_code?: string | null;
    lifecycle_reason_detail?: string | null;
  };
  className?: string;
  showReason?: boolean;
};

export function VendorIoStatusPill({
  status,
  row,
  className,
  showReason = false,
}: Props) {
  const snapshot = row
    ? vendorIoRowToLifecycleSnapshot(row)
    : vendorIoRowToLifecycleSnapshot({
        id: "unknown",
        status: status ?? "draft",
        delivery_method: null,
        delivery_status: null,
        sent_at: null,
        approved_at: null,
        attachment_url: null,
        amount: 0,
        currency_code: "USD",
      });
  const resolved = resolveVendorIoLifecycle(snapshot);
  const title =
    showReason && resolved.labels.reason
      ? `${resolved.labels.state} — ${resolved.labels.reason}`
      : resolved.labels.state;

  return (
    <span
      className={cn(
        "thinkway-campaign-badge",
        STATE_CLASS[resolved.lifecycleState] ?? "thinkway-campaign-badge-gray",
        className
      )}
      title={title}
    >
      {resolved.labels.state}
    </span>
  );
}
