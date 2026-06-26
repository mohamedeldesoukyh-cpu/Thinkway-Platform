"use client";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { cn } from "@/lib/utils";
import type { SettingsUserStatus } from "@/features/settings/types";

export function UserStatusBadge({
  status,
  className,
}: {
  status: SettingsUserStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      label={status}
      tone={resolveStatusTone("user", status)}
      className={cn("font-normal capitalize", className)}
    />
  );
}
