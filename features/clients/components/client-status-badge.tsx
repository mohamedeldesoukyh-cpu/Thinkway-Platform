import { StatusBadge } from "@/components/shared/status/status-badge";
import { cn } from "@/lib/utils";
import type { ClientStatus } from "@/types/database";

import { CLIENT_STATUS_OPTIONS } from "../constants";
import { resolveStatusTone } from "@/components/shared/status/status-utils";

type ClientStatusBadgeProps = {
  status: ClientStatus;
  className?: string;
};

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <StatusBadge
      label={label}
      tone={resolveStatusTone("client", status)}
      className={cn("font-medium", className)}
    />
  );
}
