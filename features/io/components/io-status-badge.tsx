"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

type Props = {
  status: ClientIoStatus | VendorIoStatus;
  className?: string;
};

function formatIoStatusLabel(status: ClientIoStatus | VendorIoStatus): string {
  if (status === "under_client_review") return "Under client review";
  if (status === "cancelled") return "Cancelled";
  if (status === "rejected") return "Rejected";
  if (status === "revision_required") return "Revision Required";
  if (status === "approved") return "Accepted";
  if (status === "generated") return "Pending Send";
  return status.replace(/_/g, " ");
}

export function IoStatusBadge({ status, className }: Props) {
  return (
    <StatusBadge
      label={formatIoStatusLabel(status)}
      tone={resolveStatusTone("io", status)}
      appearance="pill"
      className={className}
    />
  );
}
