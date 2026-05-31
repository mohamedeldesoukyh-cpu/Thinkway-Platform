import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/types/database";

import { CAMPAIGN_STATUS_OPTIONS } from "../constants";

const statusVariant: Record<
  CampaignStatus,
  "default" | "secondary" | "outline" | "ghost"
> = {
  draft: "secondary",
  planning: "outline",
  active: "default",
  paused: "ghost",
  completed: "secondary",
  cancelled: "ghost",
};

type CampaignStatusBadgeProps = {
  status: CampaignStatus;
};

export function CampaignStatusBadge({ status }: CampaignStatusBadgeProps) {
  const label =
    CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return <Badge variant={statusVariant[status]}>{label}</Badge>;
}
