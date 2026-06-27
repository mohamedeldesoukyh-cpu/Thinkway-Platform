"use client";

import type { VendorIoStatus } from "@/features/io/types";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<VendorIoStatus, string> = {
  draft: "thinkway-campaign-badge-gray",
  generated: "thinkway-campaign-badge-gray",
  sent: "thinkway-campaign-badge-blue",
  approved: "thinkway-campaign-badge-green",
  rejected: "thinkway-campaign-badge-red",
};

const STATUS_LABEL: Record<VendorIoStatus, string> = {
  draft: "Draft",
  generated: "Generated",
  sent: "Sent",
  approved: "Approved",
  rejected: "Rejected",
};

type Props = {
  status: VendorIoStatus;
  className?: string;
};

export function VendorIoStatusPill({ status, className }: Props) {
  return (
    <span className={cn("thinkway-campaign-badge", STATUS_CLASS[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
