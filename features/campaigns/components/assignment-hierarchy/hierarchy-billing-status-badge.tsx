"use client";

import { Badge } from "@/components/ui/badge";
import { labelForBillingStatus, labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus, CampaignLineBillingStatus } from "@/features/billing/types";
import { OPERATIONAL_STATUS_PILL_BASE } from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import { cn } from "@/lib/utils";

const LINE_BILLING_PILL_CLASS: Record<string, string> = {
  draft: "bg-muted/50 text-muted-foreground border-transparent",
  approved: "bg-sky-500/15 text-sky-900 dark:text-sky-100 border-transparent",
  moved_to_billing: "bg-violet-500/15 text-violet-900 dark:text-violet-100 border-transparent",
  partially_invoiced: "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-transparent",
  invoiced: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-transparent",
  partially_paid: "bg-teal-500/15 text-teal-900 dark:text-teal-100 border-transparent",
  paid: "bg-emerald-500/20 text-emerald-950 dark:text-emerald-50 border-transparent",
  closed: "bg-muted/60 text-muted-foreground border-transparent",
};

const DELIVERABLE_BILLING_PILL_CLASS: Record<AssignmentDeliverableBillingStatus, string> = {
  draft: "bg-muted/50 text-muted-foreground border-transparent",
  ready_to_invoice: "bg-violet-500/15 text-violet-900 dark:text-violet-100 border-transparent",
  partially_invoiced: "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-transparent",
  invoiced: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-transparent",
  partially_collected: "bg-teal-500/15 text-teal-900 dark:text-teal-100 border-transparent",
  collected: "bg-emerald-500/20 text-emerald-950 dark:text-emerald-50 border-transparent",
  disputed: "bg-red-500/15 text-red-900 dark:text-red-100 border-transparent",
  cancelled: "bg-muted/60 text-muted-foreground border-transparent",
};

type LineBillingStatusBadgeProps = {
  lineBillingStatus: CampaignLineBillingStatus | string;
  className?: string;
};

/** Parent assignment row — billing column uses line billing_status only. */
export function LineBillingStatusBadge({
  lineBillingStatus,
  className,
}: LineBillingStatusBadgeProps) {
  const status = String(lineBillingStatus ?? "draft");
  const pillClass = LINE_BILLING_PILL_CLASS[status] ?? LINE_BILLING_PILL_CLASS.draft;

  return (
    <Badge
      variant="outline"
      className={cn(OPERATIONAL_STATUS_PILL_BASE, pillClass, className)}
    >
      {labelForBillingStatus(status as CampaignLineBillingStatus)}
    </Badge>
  );
}

type DeliverableBillingStatusBadgeProps = {
  billingStatus: AssignmentDeliverableBillingStatus | string;
  className?: string;
};

/** Child deliverable/post row billing column. */
export function DeliverableBillingStatusBadge({
  billingStatus,
  className,
}: DeliverableBillingStatusBadgeProps) {
  const status = (billingStatus ?? "draft") as AssignmentDeliverableBillingStatus;
  const pillClass =
    DELIVERABLE_BILLING_PILL_CLASS[status] ?? DELIVERABLE_BILLING_PILL_CLASS.draft;

  return (
    <Badge
      variant="outline"
      className={cn(OPERATIONAL_STATUS_PILL_BASE, pillClass, className)}
    >
      {labelForDeliverableBillingStatus(status)}
    </Badge>
  );
}

/** @deprecated Use LineBillingStatusBadge or DeliverableBillingStatusBadge */
export function HierarchyBillingStatusBadge({
  lineBillingStatus,
  billingStatus,
  className,
}: {
  operationalStatus?: string;
  lineBillingStatus?: CampaignLineBillingStatus | string;
  billingStatus?: AssignmentDeliverableBillingStatus | string;
  className?: string;
}) {
  if (lineBillingStatus != null) {
    return (
      <LineBillingStatusBadge lineBillingStatus={lineBillingStatus} className={className} />
    );
  }
  return (
    <DeliverableBillingStatusBadge billingStatus={billingStatus ?? "draft"} className={className} />
  );
}
