import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { CampaignStatus } from "@/types/database";

import { CAMPAIGN_STATUS_OPTIONS } from "../constants";

type CampaignStatusBadgeProps = {
  status: CampaignStatus;
  className?: string;
};

export function CampaignStatusBadge({ status, className }: CampaignStatusBadgeProps) {
  const label =
    CAMPAIGN_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("campaign", status)}
      className={cn("font-medium", className)}
    />
  );
}
