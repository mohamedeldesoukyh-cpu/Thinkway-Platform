import { StatusBadge } from "@/components/shared/status/status-badge";
import { resolveStatusTone } from "@/components/shared/status/status-utils";
import {
  SYNC_STATUS_LABELS,
  type PlatformSyncStatus,
} from "@/lib/social/enrichment/metrics-status";
import { cn } from "@/lib/utils";

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
  const tone = resolveStatusTone("platformSync", key);

  return (
    <StatusBadge
      label={SYNC_STATUS_LABELS[key]}
      tone={tone}
      className={cn(key === "pending" && "animate-pulse", className)}
    />
  );
}
