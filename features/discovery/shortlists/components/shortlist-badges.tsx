import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CampaignShortlistAssignmentStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";

import {
  ASSIGNMENT_STATUS_LABELS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";

const STATUS_CLASSES: Record<ShortlistStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  under_review: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
  archived: "bg-muted text-muted-foreground line-through",
};

export function ShortlistStatusBadge({ status }: { status: ShortlistStatus }) {
  return (
    <Badge variant="ghost" className={cn(STATUS_CLASSES[status])}>
      {SHORTLIST_STATUS_LABELS[status]}
    </Badge>
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

const ASSIGNMENT_CLASSES: Record<CampaignShortlistAssignmentStatus, string> = {
  suggested: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  invited: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  contracted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  published: "bg-primary/15 text-primary",
  rejected: "bg-destructive/10 text-destructive",
  removed: "bg-muted text-muted-foreground line-through",
};

export function AssignmentStatusBadge({
  status,
}: {
  status: CampaignShortlistAssignmentStatus | null;
}) {
  if (!status) return null;
  return (
    <Badge variant="ghost" className={cn(ASSIGNMENT_CLASSES[status])}>
      {ASSIGNMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
