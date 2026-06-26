import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CampaignShortlistAssignmentStatus,
  ShortlistItemStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";

import {
  ASSIGNMENT_STATUS_LABELS,
  SHORTLIST_ITEM_STATUS_LABELS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";

export function ShortlistStatusBadge({ status }: { status: ShortlistStatus }) {
  return (
    <StatusBadge
      label={SHORTLIST_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlist", status)}
      appearance="ghost"
      className={cn(status === "archived" && "line-through")}
    />
  );
}

export function ShortlistVisibilityBadge({
  visibility,
}: {
  visibility: ShortlistVisibilityV2;
}) {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {SHORTLIST_VISIBILITY_LABELS[visibility]}
    </Badge>
  );
}

export function ShortlistItemStatusBadge({
  status,
}: {
  status: ShortlistItemStatus;
}) {
  return (
    <StatusBadge
      label={SHORTLIST_ITEM_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlistItem", status)}
      appearance="ghost"
      className={cn(status === "cancelled" && "line-through")}
    />
  );
}

export function AssignmentStatusBadge({
  status,
}: {
  status: CampaignShortlistAssignmentStatus | null;
}) {
  if (!status) return null;
  return (
    <StatusBadge
      label={ASSIGNMENT_STATUS_LABELS[status]}
      tone={resolveStatusTone("shortlistAssignment", status)}
      appearance="ghost"
      className={cn(status === "removed" && "line-through")}
    />
  );
}
