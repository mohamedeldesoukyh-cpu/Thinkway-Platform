"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { cn } from "@/lib/utils";

type DeliverableBillingStatusBadgeProps = {
  status: AssignmentDeliverableBillingStatus;
  className?: string;
};

export function DeliverableBillingStatusBadge({
  status,
  className,
}: DeliverableBillingStatusBadgeProps) {
  return (
    <StatusBadge
      label={labelForDeliverableBillingStatus(status)}
      tone={resolveStatusTone("deliverableBillingTable", status)}
      appearance="filled"
      className={cn("font-medium", className)}
    />
  );
}
