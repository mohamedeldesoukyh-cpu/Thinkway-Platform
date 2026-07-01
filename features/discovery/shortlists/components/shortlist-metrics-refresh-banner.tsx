"use client";

import { Loader2Icon } from "lucide-react";

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
      {!done ? (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : null}
      <span className="font-medium">{message}</span>
      {!done && inFlight > 0 ? (
        <span className="text-sky-700/80 dark:text-sky-300/80">
          ({inFlight} in progress)
        </span>
      ) : null}
    </div>
  );
}
