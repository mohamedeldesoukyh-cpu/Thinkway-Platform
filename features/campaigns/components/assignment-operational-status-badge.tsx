"use client";

import { Badge } from "@/components/ui/badge";
import { LINE_OPERATIONAL_STATUS_LABELS } from "@/features/campaigns/constants/operational-status";
import {
  normalizeOperationalStatusForOpsBadge,
  OPERATIONAL_PILL_CLASS,
  OPERATIONAL_STATUS_PILL_BASE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { cn } from "@/lib/utils";

type AssignmentOperationalStatusBadgeProps = {
  status: CampaignLineOperationalStatus | string | null | undefined;
  className?: string;
};

export function AssignmentOperationalStatusBadge({
  status,
  className,
}: AssignmentOperationalStatusBadgeProps) {
  const safe = normalizeOperationalStatusForOpsBadge(status);

  return (
    <Badge
      variant="outline"
      className={cn(OPERATIONAL_STATUS_PILL_BASE, OPERATIONAL_PILL_CLASS[safe], className)}
    >
      {LINE_OPERATIONAL_STATUS_LABELS[safe]}
    </Badge>
  );
}
