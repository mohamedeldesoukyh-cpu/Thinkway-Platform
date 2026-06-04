import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import type { CampaignStatus } from "@/types/database";

import { CAMPAIGN_STATUS_OPTIONS } from "../constants";

const statusTone: Record<CampaignStatus, StatusTone> = {
  draft: "neutral",
  planning: "info",
  active: "success",
  paused: "warning",
  completed: "accent",
  cancelled: "danger",
};

type CampaignStatusBadgeProps = {
  status: CampaignStatus;
  className?: string;
};

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const label =
    CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
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
