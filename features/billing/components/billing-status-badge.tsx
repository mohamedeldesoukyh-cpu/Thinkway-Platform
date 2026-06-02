"use client";

import { Badge } from "@/components/ui/badge";
import { labelForBillingStatus } from "@/features/billing/constants";
import type { CampaignLineBillingStatus, CollectionStatus } from "@/features/billing/types";
import { COLLECTION_STATUS_LABELS } from "@/features/billing/constants";
import { cn } from "@/lib/utils";

const BILLING_VARIANTS: Record<CampaignLineBillingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  approved: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  moved_to_billing: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  partially_invoiced: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  invoiced: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  partially_paid: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  closed: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

const COLLECTION_VARIANTS: Record<CollectionStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  partial: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  collected: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  overdue: "bg-destructive/10 text-destructive",
  written_off: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

type BillingStatusBadgeProps = {
  status: CampaignLineBillingStatus;
  className?: string;
};

export function BillingStatusBadge({ status, className }: BillingStatusBadgeProps) {
  const variant =
    BILLING_VARIANTS[status] ?? "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", variant, className)}
    >
      {labelForBillingStatus(status)}
    </Badge>
  );
}

type CollectionStatusBadgeProps = {
  status: CollectionStatus;
  className?: string;
};

export function CollectionStatusBadge({ status, className }: CollectionStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", COLLECTION_VARIANTS[status], className)}
    >
      {COLLECTION_STATUS_LABELS[status]}
    </Badge>
  );
}
