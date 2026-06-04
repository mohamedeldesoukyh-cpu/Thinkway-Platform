"use client";

import { Badge } from "@/components/ui/badge";
import { labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import {
  normalizeOperationalStatus,
  OPERATIONAL_PILL_CLASS,
  OPERATIONAL_STATUS_PILL_BASE,
} from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";
import { cn } from "@/lib/utils";

type HierarchyBillingStatusBadgeProps = {
  operationalStatus: CampaignLineOperationalStatus | string;
  billingStatus: AssignmentDeliverableBillingStatus;
  className?: string;
};

function labelForHierarchyBilling(
  operationalStatus: CampaignLineOperationalStatus,
  billingStatus: AssignmentDeliverableBillingStatus
): string {
  if (operationalStatus === "invoiced") return "Invoiced";
  if (operationalStatus === "io_generated") return "IO generated";
  if (operationalStatus === "reopened") return "Reopened";
  if (operationalStatus === "partially_invoiced") return "Partially invoiced";
  if (operationalStatus === "draft") return "Draft";
  return labelForDeliverableBillingStatus(billingStatus);
}

export function HierarchyBillingStatusBadge({
  operationalStatus,
  billingStatus,
  className,
}: HierarchyBillingStatusBadgeProps) {
  const safeOp = normalizeOperationalStatus(operationalStatus);
  const pillClass = OPERATIONAL_PILL_CLASS[safeOp];

  return (
    <Badge
      variant="outline"
      className={cn(OPERATIONAL_STATUS_PILL_BASE, pillClass, className)}
    >
      {labelForHierarchyBilling(safeOp, billingStatus)}
    </Badge>
  );
}
