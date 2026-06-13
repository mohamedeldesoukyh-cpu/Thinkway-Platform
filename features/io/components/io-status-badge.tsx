"use client";

import { Badge } from "@/components/ui/badge";
import { OPERATIONAL_STATUS_PILL_BASE } from "@/features/campaigns/components/assignment-hierarchy/operational-status-pill-styles";
import { cn } from "@/lib/utils";

import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-transparent",
  generated: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border-transparent",
  sent: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-transparent",
  approved: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-transparent",
  rejected: "bg-red-500/15 text-red-800 dark:text-red-200 border-transparent",
  cancelled: "bg-red-500/15 text-red-800 dark:text-red-200 border-transparent",
};

type Props = {
  status: ClientIoStatus | VendorIoStatus;
  className?: string;
};

export function IoStatusBadge({ status, className }: Props) {
  const label = status === "cancelled" ? "Cancelled" : status;
  return (
    <Badge
      variant="outline"
      className={cn(OPERATIONAL_STATUS_PILL_BASE, TONE[status], className)}
    >
      {label}
    </Badge>
  );
}

