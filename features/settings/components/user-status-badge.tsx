"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SettingsUserStatus } from "@/features/settings/types";

const TONE: Record<SettingsUserStatus, string> = {
  invited: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  disabled: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
};

export function UserStatusBadge({ status, className }: { status: SettingsUserStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal capitalize", TONE[status], className)}>
      {status}
    </Badge>
  );
}
