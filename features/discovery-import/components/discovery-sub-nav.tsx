import Link from "next/link";

import { cn } from "@/lib/utils";
import { DiscoveryDatabaseStatsBar } from "@/features/discovery/components/discovery-database-stats-bar";
import { getDiscoveryDatabaseStats } from "@/features/discovery/queries";

import {
  DISCOVERY_SUB_NAV_PAGES,
  DiscoveryPageIconBadge,
} from "@/features/discovery/components/discovery-page-identity";

type DiscoverySubNavProps = {
  activeHref: string;
  /** Hide creator database stats bar (e.g. on quotation workspace). */
  showDatabaseStats?: boolean;
};

function resolveActiveTabClass(isActive: boolean, pageKey: string): string {
  if (!isActive) {
    return "text-muted-foreground hover:bg-muted/60 hover:text-foreground";
  }

  if (pageKey === "import") {
    return "border border-emerald-200 bg-emerald-50 font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }

  return "border border-blue-200 bg-blue-50 font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
}

export async function DiscoverySubNav({
  activeHref,
  showDatabaseStats = true,
}: DiscoverySubNavProps) {
  let stats: Awaited<ReturnType<typeof getDiscoveryDatabaseStats>> | null = null;
  let statsError: string | null = null;

  if (showDatabaseStats) {
    try {
      stats = await getDiscoveryDatabaseStats();
    } catch (error) {
      statsError =
        error instanceof Error ? error.message : "Failed to load creator database stats.";
    }
  }

  return (
    <>
      <nav
        aria-label="Discovery"
        className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border bg-background px-5 py-2.5"
      >
        {DISCOVERY_SUB_NAV_PAGES.map((page) => {
          const isActive = activeHref === page.href;
          return (
            <Link
              key={page.href}
              href={page.href}
              className={cn(
                "inline-flex h-[30px] items-center gap-1.5 rounded-md border border-transparent px-3 text-xs font-medium transition-colors",
                resolveActiveTabClass(isActive, page.key)
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <DiscoveryPageIconBadge identity={page} size="sm" />
              <span>{page.navLabel}</span>
            </Link>
          );
        })}
      </nav>
      {showDatabaseStats ? (
        <DiscoveryDatabaseStatsBar stats={stats} errorMessage={statsError} />
      ) : null}
    </>
  );
}
