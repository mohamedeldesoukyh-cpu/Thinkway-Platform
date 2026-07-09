import {
  Loader2Icon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleAlertIcon,
  ClockIcon,
  type LucideIcon,
} from "lucide-react";

import { StatusBadge } from "@/components/shared/status/status-badge";
import { CREATOR_ENRICHMENT_STATUS_TONE } from "@/components/shared/status/status-config";
import { cn } from "@/lib/utils";

import type { CreatorEnrichmentStatus } from "../status";

const STATUS_META: Record<
  CreatorEnrichmentStatus,
  { label: string; icon: LucideIcon; spin?: boolean }
> = {
  never: {
    label: "Not enriched",
    icon: CircleDashedIcon,
  },
  queued: {
    label: "Queued",
    icon: ClockIcon,
  },
  running: {
    label: "Updating",
    icon: Loader2Icon,
    spin: true,
  },
  enriched: {
    label: "Updated",
    icon: CircleCheckIcon,
  },
  partial: {
    label: "Partial failure",
    icon: CircleAlertIcon,
  },
  failed: {
    label: "Failed",
    icon: CircleAlertIcon,
  },
  skipped: {
    label: "Up to date",
    icon: CircleCheckIcon,
  },
};

/** Self-contained enrichment status badge (spec §1/§3). */
export function EnrichmentStatusBadge({
  status,
  workerOfflineHint,
  className,
}: {
  status: CreatorEnrichmentStatus;
  /** When true, queued badge explains the discovery worker may be offline. */
  workerOfflineHint?: boolean;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.never;
  const Icon = meta.icon;
  const tone = CREATOR_ENRICHMENT_STATUS_TONE[status] ?? CREATOR_ENRICHMENT_STATUS_TONE.never;
  const label =
    status === "queued" && workerOfflineHint
      ? "Queued (worker offline)"
      : meta.label;
  const title =
    status === "queued" && workerOfflineHint
      ? "Enrichment jobs are waiting in Redis but discovery-worker is not processing them. Run npm run discovery-worker."
      : status === "queued"
        ? "Waiting for discovery-worker to process the enrichment job."
        : undefined;

  return (
    <span title={title}>
      <StatusBadge
        label={label}
        tone={tone}
        className={cn("gap-1 font-medium", className)}
      >
        <Icon aria-hidden className={cn(meta.spin && "animate-spin")} />
        {label}
      </StatusBadge>
    </span>
  );
}
