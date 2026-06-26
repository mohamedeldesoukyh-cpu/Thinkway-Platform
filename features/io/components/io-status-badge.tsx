"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

type Props = {
  status: ClientIoStatus | VendorIoStatus;
  className?: string;
};

export function IoStatusBadge({ status, className }: Props) {
  const label = status === "cancelled" ? "Cancelled" : status;
  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("io", status)}
      appearance="pill"
      className={className}
    />
  );
}
