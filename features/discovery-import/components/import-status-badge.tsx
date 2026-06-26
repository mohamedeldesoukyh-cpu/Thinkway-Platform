import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  CREATOR_IMPORT_STATUSES,
  type CreatorImportStatus,
} from "@/features/discovery-import/types";

const STATUS_LABELS: Record<CreatorImportStatus, string> = {
  uploaded: "Uploaded",
  queued: "Queued",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_STYLES: Record<
  CreatorImportStatus,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  uploaded: {
    variant: "secondary",
    className: "border-border bg-muted text-muted-foreground",
  },
  queued: {
    variant: "secondary",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
  processing: {
    variant: "secondary",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  completed: {
    variant: "default",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  failed: {
    variant: "destructive",
  },
};

type ImportStatusBadgeProps = {
  status: string;
  className?: string;
};

export function ImportStatusBadge({ status, className }: ImportStatusBadgeProps) {
  const key = (CREATOR_IMPORT_STATUSES.includes(status as CreatorImportStatus)
    ? status
    : "uploaded") as CreatorImportStatus;
  const style = STATUS_STYLES[key];

  return (
    <Badge variant={style.variant} className={cn(style.className, className)}>
      {STATUS_LABELS[key]}
    </Badge>
  );
}
