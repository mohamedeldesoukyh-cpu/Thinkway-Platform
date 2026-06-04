import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import type { InfluencerStatus } from "@/types/database";

import { VENDOR_STATUS_OPTIONS } from "../constants";

const statusTone: Record<InfluencerStatus, StatusTone> = {
  prospect: "info",
  active: "success",
  inactive: "neutral",
  blacklisted: "danger",
  archived: "neutral",
};

type VendorStatusBadgeProps = {
  status: InfluencerStatus;
  className?: string;
};

export function VendorStatusBadge({ status, className }: VendorStatusBadgeProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUS_TONE_CLASS[statusTone[status]], className)}
    >
      {label}
    </Badge>
  );
}
