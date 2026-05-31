import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/types/database";

import { CLIENT_STATUS_OPTIONS } from "../constants";

const statusVariant: Record<
  ClientStatus,
  "default" | "secondary" | "outline" | "ghost"
> = {
  prospect: "secondary",
  active: "default",
  inactive: "outline",
  archived: "ghost",
};

type ClientStatusBadgeProps = {
  status: ClientStatus;
};

export function ClientStatusBadge({ status }: ClientStatusBadgeProps) {
  const label =
    CLIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    status;

  return <Badge variant={statusVariant[status]}>{label}</Badge>;
}
