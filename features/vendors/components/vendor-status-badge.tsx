import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { InfluencerStatus } from "@/types/database";

import { VENDOR_STATUS_OPTIONS } from "../constants";

type VendorStatusBadgeProps = {
  status: InfluencerStatus;
  className?: string;
};

export function VendorStatusBadge({ status, className }: VendorStatusBadgeProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("vendor", status)}
      className={cn("font-medium", className)}
    />
  );
}
