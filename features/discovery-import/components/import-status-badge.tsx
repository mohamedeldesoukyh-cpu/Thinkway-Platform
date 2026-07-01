import { cn } from "@/lib/utils";

import {
  CREATOR_IMPORT_STATUSES,
  type CreatorImportStatus,
} from "@/features/discovery-import/types";

const STATUS_LABELS: Record<CreatorImportStatus, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  processing: "Processing",
  paused: "Paused",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_STYLES: Record<CreatorImportStatus, string> = {
  uploaded: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  queued: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  processing: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  paused: "bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  completed: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  failed: "bg-red-50 text-red-800 dark:bg-red-950/50 dark:text-red-300",
};

type ImportStatusBadgeProps = {
  status: string;
  className?: string;
};

export function ImportStatusBadge({ status, className }: ImportStatusBadgeProps) {
  const key = (CREATOR_IMPORT_STATUSES.includes(status as CreatorImportStatus)
    ? status
    : "uploaded") as CreatorImportStatus;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
        STATUS_STYLES[key],
        className
      )}
    >
      {STATUS_LABELS[key]}
    </span>
  );
}
