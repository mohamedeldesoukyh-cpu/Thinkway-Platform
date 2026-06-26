import {
  Loader2Icon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleAlertIcon,
  ClockIcon,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { CreatorEnrichmentStatus } from "../status";

const STATUS_META: Record<
  CreatorEnrichmentStatus,
  { label: string; icon: LucideIcon; className: string; spin?: boolean }
> = {
  never: {
    label: "Not enriched",
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground border-border",
  },
  queued: {
    label: "Queued",
    icon: ClockIcon,
    className: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
  },
  running: {
    label: "Enriching",
    icon: Loader2Icon,
    className: "bg-primary/10 text-primary border-primary/20",
    spin: true,
  },
  enriched: {
    label: "Enriched",
    icon: CircleCheckIcon,
    className:
      "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  },
  partial: {
    label: "Partial",
    icon: CircleAlertIcon,
    className:
      "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  },
  failed: {
    label: "Failed",
    icon: CircleAlertIcon,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  skipped: {
    label: "Up to date",
    icon: CircleCheckIcon,
    className: "bg-muted text-muted-foreground border-border",
  },
};

/** Self-contained enrichment status badge (spec §1/§3). */
export function EnrichmentStatusBadge({
  status,
  className,
}: {
  status: CreatorEnrichmentStatus;
  className?: string;
}) {
  const meta = STATUS_META[status] ?? STATUS_META.never;
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-medium", meta.className, className)}
    >
      <Icon aria-hidden className={cn(meta.spin && "animate-spin")} />
      {meta.label}
    </Badge>
  );
}
