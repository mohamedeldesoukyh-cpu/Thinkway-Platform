import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_TONE_CLASS, type StatusTone } from "@/lib/ui/status-tone";
import type { ClientStatus } from "@/types/database";

import { CLIENT_STATUS_OPTIONS } from "../constants";

const statusTone: Record<ClientStatus, StatusTone> = {
  prospect: "info",
  active: "success",
  inactive: "neutral",
  archived: "neutral",
};

type ClientStatusBadgeProps = {
  status: ClientStatus;
};

export function ClientStatusBadge({ status }: ClientStatusBadgeProps) {
  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_TONE_CLASS[statusTone[status]])}>
      {label}
    </Badge>
  );
}
