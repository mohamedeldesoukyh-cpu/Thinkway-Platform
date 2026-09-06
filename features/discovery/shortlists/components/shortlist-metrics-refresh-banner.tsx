"use client";

import { batchRefreshProgress } from "@/features/discovery/enrichment/refresh-metrics-progress";
import { RefreshMetricsProgressCircle } from "@/features/discovery/enrichment/components/refresh-metrics-progress-circle";
import { cn } from "@/lib/utils";

type Props = {
  total: number;
  completed: number;
  failed: number;
  className?: string;
};

export function ShortlistMetricsRefreshBanner({
  total,
  completed,
  failed,
  className,
}: Props) {
  const inFlight = Math.max(0, total - completed);
  const done = completed >= total;
  const progress = batchRefreshProgress({ total, completed, failed });

  let message: string;
  if (done) {
    message =
      failed > 0
        ? `Metrics refresh finished — ${failed} of ${total} failed.`
        : `Metrics updated for ${total} creator${total === 1 ? "" : "s"}.`;
  } else if (completed === 0) {
    message = `Collecting metrics for ${total} creator${total === 1 ? "" : "s"}…`;
  } else {
    message = `Collecting metrics… ${completed} of ${total} complete`;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-2.5 border-b border-sky-500/40 bg-sky-500/10 px-5 py-3 text-xs text-sky-900 dark:text-sky-100 sm:px-6",
        className
      )}
    >
      <RefreshMetricsProgressCircle progress={progress} size="md" />
      <span className="font-medium">{message}</span>
      {!done && inFlight > 0 ? (
        <span className="text-sky-700/80 dark:text-sky-300/80">
          ({inFlight} in progress)
        </span>
      ) : null}
    </div>
  );
}
