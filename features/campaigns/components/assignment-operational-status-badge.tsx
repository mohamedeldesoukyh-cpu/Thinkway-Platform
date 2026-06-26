"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { LINE_OPERATIONAL_STATUS_LABELS } from "@/features/campaigns/constants/operational-status";
import { normalizeOperationalStatusForOpsBadge } from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";

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
    <StatusBadge
      label={LINE_OPERATIONAL_STATUS_LABELS[safe]}
      tone={resolveStatusTone("operational", safe)}
      appearance="pill"
      className={className}
    />
  );
}
