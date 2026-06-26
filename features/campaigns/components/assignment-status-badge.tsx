import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { ASSIGNMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { CampaignLineAssignmentStatus } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

type AssignmentStatusBadgeProps = {
  status: CampaignLineAssignmentStatus;
  className?: string;
};

export function AssignmentStatusBadge({ status, className }: AssignmentStatusBadgeProps) {
  return (
    <StatusBadge
      label={ASSIGNMENT_STATUS_LABELS[status] ?? status}
      tone={resolveStatusTone("campaignAssignment", status)}
      appearance="outline"
      className={cn("font-normal capitalize", className)}
    />
  );
}
