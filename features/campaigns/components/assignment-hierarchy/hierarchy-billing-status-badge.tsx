"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { labelForBillingStatus, labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus, CampaignLineBillingStatus } from "@/features/billing/types";

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

  return (
    <StatusBadge
      label={labelForBillingStatus(status as CampaignLineBillingStatus)}
      tone={resolveStatusTone("lineBillingHierarchy", status)}
      appearance="pill"
      className={className}
    />
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

  return (
    <StatusBadge
      label={labelForDeliverableBillingStatus(status)}
      tone={resolveStatusTone("deliverableBillingHierarchy", status)}
      appearance="pill"
      className={className}
    />
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
