"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

const TONE: Record<string, string> = {
  draft: "border-muted-foreground/30 text-muted-foreground",
  sent: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

type Props = {
  status: ClientIoStatus | VendorIoStatus;
  className?: string;
};

export function IoStatusBadge({ status, className }: Props) {
  return (
    <Badge variant="outline" className={cn("font-normal capitalize", TONE[status], className)}>
      {status}
    </Badge>
  );
}

