"use client";

import { cn } from "@/lib/utils";

/** Keeps Outputs launcher row height stable while execution context refreshes. */
export function GenerateLauncherPlaceholder({
  variant = "default",
  className,
}: {
  variant?: "default" | "compact";
  className?: string;
}) {
  const compact = variant === "compact";

  return (
    <div
      className={cn(
        compact ? "p-2.5" : "rounded-xl border border-border bg-background p-4",
        className
      )}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div
            className={cn(
              "animate-pulse rounded bg-muted/70",
              compact ? "h-3.5 w-28" : "h-4 w-40"
            )}
          />
          <div
            className={cn(
              "animate-pulse rounded bg-muted/50",
              compact ? "h-2.5 w-36" : "h-3 w-48"
            )}
          />
        </div>
        <div
          className={cn(
            "shrink-0 animate-pulse rounded-md bg-muted/70",
            compact ? "h-6 w-20" : "h-8 w-24"
          )}
        />
      </div>
      {compact ? (
        <div className="mt-1.5 h-2.5 w-44 animate-pulse rounded bg-muted/40" />
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="h-10 animate-pulse rounded bg-muted/40" />
          <div className="h-10 animate-pulse rounded bg-muted/40" />
        </div>
      )}
    </div>
  );
}
