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

const KNOWN_DELIVERABLE_BILLING: AssignmentDeliverableBillingStatus[] = [
  "draft",
  "ready_to_invoice",
  "partially_invoiced",
  "invoiced",
  "partially_collected",
  "collected",
  "disputed",
  "cancelled",
];

function normalizeDeliverableBillingStatus(
  status: AssignmentDeliverableBillingStatus | string | null | undefined
): AssignmentDeliverableBillingStatus {
  const key = (status ?? "draft") as AssignmentDeliverableBillingStatus;
  return KNOWN_DELIVERABLE_BILLING.includes(key) ? key : "draft";
}

type HierarchyBillingStatusBadgeProps = {
  operationalStatus: CampaignLineOperationalStatus | string;
  billingStatus: AssignmentDeliverableBillingStatus | string;
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
  if (operationalStatus === "moved_to_billing") return "Moved to billing";
  if (operationalStatus === "closed") return "Closed";
  if (operationalStatus === "draft") return "Draft";
  return labelForDeliverableBillingStatus(billingStatus);
}

export function HierarchyBillingStatusBadge({
  operationalStatus,
  billingStatus,
  className,
}: HierarchyBillingStatusBadgeProps) {
  const safeOp = normalizeOperationalStatus(operationalStatus);
  const safeBilling = normalizeDeliverableBillingStatus(billingStatus);
  const pillClass = OPERATIONAL_PILL_CLASS[safeOp];

  return (
    <Badge
      variant="outline"
      className={cn(OPERATIONAL_STATUS_PILL_BASE, pillClass, className)}
    >
      {labelForHierarchyBilling(safeOp, safeBilling)}
    </Badge>
  );
}
