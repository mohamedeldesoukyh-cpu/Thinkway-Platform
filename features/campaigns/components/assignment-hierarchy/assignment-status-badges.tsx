"use client";

import { labelForBillingStatus, labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type {
  AssignmentDeliverableBillingStatus,
  CampaignLineBillingStatus,
} from "@/features/billing/types";
import { AssignmentCampaignBadge, type AssignmentCampaignBadgeTone } from "@/features/campaigns/components/assignment-hierarchy/assignment-campaign-badge";
import { LINE_OPERATIONAL_STATUS_LABELS } from "@/features/campaigns/constants/operational-status";
import { normalizeOperationalStatusForOpsBadge } from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import type { CampaignLineOperationalStatus } from "@/features/campaigns/types/operational";

function operationalBadgeTone(status: CampaignLineOperationalStatus): AssignmentCampaignBadgeTone {
  switch (status) {
    case "locked":
    case "closed":
    case "draft":
      return "gray";
    case "io_revised":
    case "reopened":
      return "amber";
    case "partially_invoiced":
    case "invoiced":
      return "green";
    default:
      return "blue";
  }
}

function billingBadgeTone(status: string): AssignmentCampaignBadgeTone {
  switch (status) {
    case "invoiced":
    case "paid":
      return "green";
    case "partially_invoiced":
    case "partially_paid":
      return "amber";
    case "draft":
    case "closed":
      return "gray";
    default:
      return "blue";
  }
}

type AssignmentOpsStatusBadgeProps = {
  status: CampaignLineOperationalStatus | string | null | undefined;
};

export function AssignmentOpsStatusBadge({ status }: AssignmentOpsStatusBadgeProps) {
  const safe = normalizeOperationalStatusForOpsBadge(status);

  return (
    <AssignmentCampaignBadge tone={operationalBadgeTone(safe)}>
      {LINE_OPERATIONAL_STATUS_LABELS[safe]}
    </AssignmentCampaignBadge>
  );
}

type AssignmentLineBillingBadgeProps = {
  lineBillingStatus: CampaignLineBillingStatus | string;
};

export function AssignmentLineBillingBadge({
  lineBillingStatus,
}: AssignmentLineBillingBadgeProps) {
  const status = String(lineBillingStatus ?? "draft");

  return (
    <AssignmentCampaignBadge tone={billingBadgeTone(status)}>
      {labelForBillingStatus(status as CampaignLineBillingStatus)}
    </AssignmentCampaignBadge>
  );
}

type AssignmentDeliverableBillingBadgeProps = {
  billingStatus: AssignmentDeliverableBillingStatus | string;
};

export function AssignmentDeliverableBillingBadge({
  billingStatus,
}: AssignmentDeliverableBillingBadgeProps) {
  const status = (billingStatus ?? "draft") as AssignmentDeliverableBillingStatus;

  return (
    <AssignmentCampaignBadge tone={billingBadgeTone(status)} className="text-[9px]">
      {labelForDeliverableBillingStatus(status)}
    </AssignmentCampaignBadge>
  );
}
