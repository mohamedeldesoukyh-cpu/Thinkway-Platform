"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { labelForBillingStatus } from "@/features/billing/constants";
import type { CampaignLineBillingStatus, CollectionStatus } from "@/features/billing/types";
import { COLLECTION_STATUS_LABELS } from "@/features/billing/constants";
import { cn } from "@/lib/utils";

type BillingStatusBadgeProps = {
  status: CampaignLineBillingStatus;
  className?: string;
};

export function BillingStatusBadge({ status, className }: BillingStatusBadgeProps) {
  return (
    <StatusBadge
      label={labelForBillingStatus(status)}
      tone={resolveStatusTone("lineBillingTable", status)}
      appearance="filled"
      className={cn("font-medium", className)}
    />
  );
}

type CollectionStatusBadgeProps = {
  status: CollectionStatus;
  className?: string;
};

export function CollectionStatusBadge({ status, className }: CollectionStatusBadgeProps) {
  return (
    <StatusBadge
      label={COLLECTION_STATUS_LABELS[status]}
      tone={resolveStatusTone("collection", status)}
      appearance="filled"
      className={cn("font-medium", className)}
    />
  );
}
