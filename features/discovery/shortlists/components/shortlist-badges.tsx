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
  variant = "default",
}: {
  status: ShortlistItemStatus;
  variant?: "default" | "table";
}) {
  if (variant === "table") {
    return (
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-full border px-2 text-[10px] font-semibold",
          status === "draft" && "border-border bg-muted/60 text-muted-foreground",
          status === "under_review" &&
            "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
          status === "approved" &&
            "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
          status === "rejected" &&
            "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
          (status === "moved_to_campaign" || status === "cancelled") &&
            "border-border bg-muted/60 text-muted-foreground",
          status === "cancelled" && "line-through"
        )}
      >
        {SHORTLIST_ITEM_STATUS_LABELS[status]}
      </span>
    );
  }

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
