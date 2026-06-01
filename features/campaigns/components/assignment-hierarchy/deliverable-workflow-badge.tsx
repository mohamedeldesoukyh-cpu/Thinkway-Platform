"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const WORKFLOW_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  posted: "Posted",
  verified: "Verified",
  cancelled: "Cancelled",
  assigned: "Assigned",
  awaiting_content: "Awaiting content",
  submitted: "Submitted",
  invoiced: "Invoiced",
  paid: "Paid",
  closed: "Closed",
};

const WORKFLOW_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  awaiting_approval: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  posted: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  verified: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  cancelled: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

type DeliverableWorkflowBadgeProps = {
  status: string;
  className?: string;
};

export function DeliverableWorkflowBadge({
  status,
  className,
}: DeliverableWorkflowBadgeProps) {
  const key = status.replace(/-/g, "_");
  return (
    <Badge
      variant="outline"
      className={cn(
        "border-transparent font-normal capitalize",
        WORKFLOW_TONE[key] ?? WORKFLOW_TONE.draft,
        className
      )}
    >
      {WORKFLOW_LABELS[key] ?? status.replace(/_/g, " ")}
    </Badge>
  );
}
