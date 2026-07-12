import { cn } from "@/lib/utils";

import type { CampaignOutputStatus } from "../output-types";

/**
 * Status pill for a Campaign Output. "Needs Update" always carries the precise
 * reason (e.g. "Creator slate changed") — never a generic message.
 */
export function OutputStatusBadge({
  status,
  staleReason,
  className,
}: {
  status: CampaignOutputStatus;
  staleReason?: string;
  className?: string;
}) {
  if (status === "generated") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300",
          className
        )}
      >
        <span className="size-1.5 rounded-full bg-emerald-500" />
        Up to date
      </span>
    );
  }

  if (status === "needs_update") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300",
          className
        )}
        title={staleReason ? `Reason: ${staleReason}` : undefined}
      >
        <span className="size-1.5 rounded-full bg-amber-500" />
        Needs Update
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-muted-foreground/50" />
      Not Generated
    </span>
  );
}
