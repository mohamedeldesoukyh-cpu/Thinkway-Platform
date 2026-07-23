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
  /**
   * embedded — inside DiscoverySubNav (border-top only; parent owns chrome)
   * standalone — legacy /discovery page (own border + background)
   */
  variant?: "embedded" | "standalone";
};

function formatCount(value: number): string {
  return value.toLocaleString();
}

/**
 * Stats + category chips row — matches HTML `.d-stats-row` / `.d-stat` / `.d-cats`.
 */
export function DiscoveryDatabaseStatsBar({
  stats,
  errorMessage,
  className,
  variant = "embedded",
}: DiscoveryDatabaseStatsBarProps) {
  const chrome =
    variant === "standalone"
      ? "shrink-0 border-b border-[var(--tw-border)] bg-background px-4 py-2.5"
      : "border-t border-[var(--tw-border)] py-2.5";

  if (errorMessage) {
    return (
      <section
        aria-label="Creator database stats"
        className={cn(chrome, "text-xs text-destructive", className)}
      >
        {errorMessage}
      </section>
    );
  }

  if (!stats) {
    return (
      <section
        aria-label="Creator database stats"
        className={cn(chrome, className)}
      >
        <div className="flex flex-wrap items-center gap-3.5">
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
      className={cn(chrome, className)}
    >
      <div className="flex flex-wrap items-center gap-3.5">
        <Link
          href={buildCreatorSearchHref()}
          className="flex min-w-0 items-center gap-[7px] rounded-md transition-colors hover:opacity-80"
        >
          <UsersIcon
            className="size-[15px] shrink-0 text-[var(--green)]"
            aria-hidden
          />
          <p className="text-[12.5px] font-bold text-[var(--text)] dark:text-foreground">
            <span className="tabular-nums">
              {formatCount(stats.totalCreators)}
            </span>{" "}
            {stats.totalCreators === 1 ? "creator" : "creators"} in your database
          </p>
        </Link>

        <Suspense
          fallback={
            <div className="ml-1.5 flex min-w-0 flex-wrap items-center gap-2">
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
