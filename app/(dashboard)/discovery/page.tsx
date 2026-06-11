import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoveryWorkspace } from "@/features/discovery/components/discovery-workspace";
import {
  getDiscoverySearch,
  getDiscoveryShortlists,
  getDiscoveryStats,
  getRecentDiscoveryJobs,
} from "@/features/discovery/queries";

export default async function DiscoveryPage() {
  const [results, stats, shortlists, recentJobs] = await Promise.all([
    getDiscoverySearch({ pageSize: 24 }),
    getDiscoveryStats(),
    getDiscoveryShortlists(),
    getRecentDiscoveryJobs(8),
  ]);

  return (
    <DashboardShell
      title="Creator Discovery"
      description="Public-signal influencer discovery — hashtag, competitor, location, and trend crawlers with AI scoring. No paid APIs required."
    >
      <PlatformErrorBoundary surface="generic">
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
