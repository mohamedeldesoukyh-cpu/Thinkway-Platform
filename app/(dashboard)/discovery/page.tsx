import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoveryWorkspace } from "@/features/discovery/components/discovery-workspace";
import { DiscoveryDatabaseStatsBar } from "@/features/discovery/components/discovery-database-stats-bar";
import {
  getDiscoveryDatabaseStats,
  getDiscoverySearch,
  getDiscoveryShortlists,
  getDiscoveryStats,
  getRecentDiscoveryJobs,
} from "@/features/discovery/queries";

export default async function DiscoveryPage() {
  let databaseStats: Awaited<ReturnType<typeof getDiscoveryDatabaseStats>> | null = null;
  let databaseStatsError: string | null = null;

  const [results, stats, shortlists, recentJobs] = await Promise.all([
    getDiscoverySearch({ pageSize: 24 }),
    getDiscoveryStats(),
    getDiscoveryShortlists(),
    getRecentDiscoveryJobs(8),
  ]);

  try {
    databaseStats = await getDiscoveryDatabaseStats();
  } catch (error) {
    databaseStatsError =
      error instanceof Error ? error.message : "Failed to load creator database stats.";
  }

  return (
    <DashboardShell
      title="Creator Discovery"
      description="Public-signal influencer discovery — hashtag, competitor, location, and trend crawlers with AI scoring. No paid APIs required."
    >
      <PlatformErrorBoundary surface="generic">
        <DiscoveryDatabaseStatsBar stats={databaseStats} errorMessage={databaseStatsError} />
        <DiscoveryWorkspace
          initialResults={results}
          stats={stats}
          shortlists={shortlists}
          recentJobs={recentJobs}
        />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
