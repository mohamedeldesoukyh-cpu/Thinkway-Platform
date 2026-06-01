import { Badge } from "@/components/ui/badge";
import {
  SYNC_STATUS_LABELS,
  type PlatformSyncStatus,
} from "@/lib/social/enrichment/metrics-status";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<
  PlatformSyncStatus,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  synced: {
    variant: "default",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  },
  partial: {
    variant: "secondary",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
  manual: {
    variant: "outline",
    className: "text-muted-foreground",
  },
  failed: {
    variant: "destructive",
  },
  pending: {
    variant: "secondary",
    className: "animate-pulse",
  },
  pending_api: {
    variant: "secondary",
    className:
      "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300",
  },
};

type EnrichmentStatusBadgeProps = {
  status: PlatformSyncStatus | string;
  className?: string;
};

export function EnrichmentStatusBadge({
  status,
  className,
}: EnrichmentStatusBadgeProps) {
  const key = (status in SYNC_STATUS_LABELS
    ? status
    : "manual") as PlatformSyncStatus;
  const style = STATUS_STYLES[key];

  return (
    <Badge
      variant={style.variant}
      className={cn(style.className, className)}
    >
      {SYNC_STATUS_LABELS[key]}
    </Badge>
  );
}
