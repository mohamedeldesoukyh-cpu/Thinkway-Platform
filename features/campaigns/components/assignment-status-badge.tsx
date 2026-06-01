import { Badge } from "@/components/ui/badge";
import { ASSIGNMENT_STATUS_LABELS } from "@/features/campaigns/constants";
import type { CampaignLineAssignmentStatus } from "@/features/campaigns/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Partial<Record<CampaignLineAssignmentStatus, string>> = {
  draft: "border-muted-foreground/30 text-muted-foreground",
  assigned: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  awaiting_content: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  submitted: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  approved: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  scheduled: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  posted: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  verified: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  invoiced: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  paid: "border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300",
  closed: "border-border text-muted-foreground",
};

type AssignmentStatusBadgeProps = {
  status: CampaignLineAssignmentStatus;
  className?: string;
};

export function AssignmentStatusBadge({ status, className }: AssignmentStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("font-normal capitalize", STATUS_TONE[status], className)}
    >
      {ASSIGNMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
