import { Badge } from "@/components/ui/badge";
import type { InfluencerStatus } from "@/types/database";

import { VENDOR_STATUS_OPTIONS } from "../constants";

const statusVariant: Record<
  InfluencerStatus,
  "default" | "secondary" | "outline" | "ghost" | "destructive"
> = {
  prospect: "secondary",
  active: "default",
  inactive: "outline",
  blacklisted: "destructive",
  archived: "ghost",
};

type VendorStatusBadgeProps = {
  status: InfluencerStatus;
};

export function VendorStatusBadge({ status }: VendorStatusBadgeProps) {
  const label =
    VENDOR_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return <Badge variant={statusVariant[status]}>{label}</Badge>;
}
