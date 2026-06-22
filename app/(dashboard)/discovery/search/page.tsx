import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { CreatorSearchWorkspace } from "@/features/discovery/components/creator-search/creator-search-workspace";
import { getDiscoveryShortlists } from "@/features/discovery/queries";
import { cn } from "@/lib/utils";

export default async function CreatorSearchPage() {
  const shortlists = await getDiscoveryShortlists();

  return (
    <DashboardShell
      title="Creator Search"
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <nav
            aria-label="Discovery"
            className="flex shrink-0 items-center gap-4 border-b border-[#E6EAF2] bg-white px-4 py-2 text-[12px] md:px-5"
          >
            <Link
              href="/discovery/search"
              className={cn("font-semibold text-[#0057FF]")}
              aria-current="page"
            >
              Creator Search
            </Link>
            <Link
              href="/discovery/compare"
              className="font-medium text-[#5B6575] hover:text-[#0057FF]"
            >
              Compare
            </Link>
            <Link
              href="/discovery"
              className="font-medium text-[#5B6575] hover:text-[#0057FF]"
            >
              Discovery hub
            </Link>
          </nav>
          <div className="min-h-0 flex-1 overflow-hidden">
            <CreatorSearchWorkspace shortlists={shortlists} />
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
