"use client";

import { Badge } from "@/components/ui/badge";
import { labelForDeliverableBillingStatus } from "@/features/billing/constants";
import type { AssignmentDeliverableBillingStatus } from "@/features/billing/types";
import { cn } from "@/lib/utils";

const VARIANTS: Record<AssignmentDeliverableBillingStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  ready_to_invoice: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  partially_invoiced: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  invoiced: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  partially_collected: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  collected: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  disputed: "bg-destructive/10 text-destructive",
  cancelled: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

type DeliverableBillingStatusBadgeProps = {
  status: AssignmentDeliverableBillingStatus;
  className?: string;
};

export function DeliverableBillingStatusBadge({
  status,
  className,
}: DeliverableBillingStatusBadgeProps) {
  const variant = VARIANTS[status] ?? "bg-muted text-muted-foreground";

  return (
    <Badge
      variant="outline"
      className={cn("border-transparent font-medium", variant, className)}
    >
      {labelForDeliverableBillingStatus(status)}
    </Badge>
  );
}
