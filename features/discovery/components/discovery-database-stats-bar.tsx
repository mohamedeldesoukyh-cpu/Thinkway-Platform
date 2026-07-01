import { Suspense } from "react";
import Link from "next/link";
import { UsersIcon } from "lucide-react";

import type { DiscoveryDatabaseStats } from "@/lib/discovery/database-stats";
import { buildCreatorSearchHref } from "@/lib/creators/category-filter";
import { cn } from "@/lib/utils";

import { DiscoveryDatabaseStatsChips } from "./discovery-database-stats-chips";

type DiscoveryDatabaseStatsBarProps = {
  stats: DiscoveryDatabaseStats | null;
  errorMessage?: string | null;
  className?: string;
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

export function DiscoveryDatabaseStatsBar({
  stats,
  errorMessage,
  className,
}: DiscoveryDatabaseStatsBarProps) {
  if (errorMessage) {
    return (
      <section
        aria-label="Creator database stats"
        className={cn(
          "shrink-0 border-b border-border bg-muted/30 px-5 py-2 text-xs text-destructive",
          className
        )}
      >
        {errorMessage}
      </section>
    );
  }

  if (!stats) {
    return (
      <section
        aria-label="Creator database stats"
        className={cn(
          "shrink-0 border-b border-border bg-muted/20 px-5 py-2.5",
          className
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 w-28 animate-pulse rounded-full bg-muted" />
          <span className="inline-flex h-5 w-40 animate-pulse rounded-full bg-muted/70" />
          <span className="inline-flex h-5 w-32 animate-pulse rounded-full bg-muted/70" />
        </div>
      </section>
    );
  }

  const visibleCategories = stats.topCategories.filter(
    (item) => item.label !== "Uncategorized"
  );
  const uncategorized = stats.topCategories.find((item) => item.label === "Uncategorized");

  return (
    <section
      aria-label="Creator database stats"
      className={cn(
        "shrink-0 border-b border-border bg-muted/20 px-5 py-2.5",
        className
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={buildCreatorSearchHref()}
          className="flex min-w-0 items-center gap-2 rounded-md transition-colors hover:opacity-80"
        >
          <UsersIcon className="size-3.5 shrink-0 text-[#1D9E75]" aria-hidden />
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-[#1D9E75]">
              {formatCount(stats.totalCreators)}
            </span>{" "}
            {stats.totalCreators === 1 ? "creator" : "creators"} in your database
          </p>
        </Link>

        <Suspense
          fallback={
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="inline-flex h-5 w-24 animate-pulse rounded-full bg-muted/70" />
              <span className="inline-flex h-5 w-32 animate-pulse rounded-full bg-muted/70" />
            </div>
          }
        >
          <DiscoveryDatabaseStatsChips
            categories={visibleCategories}
            uncategorized={uncategorized}
          />
        </Suspense>
      </div>
    </section>
  );
}
