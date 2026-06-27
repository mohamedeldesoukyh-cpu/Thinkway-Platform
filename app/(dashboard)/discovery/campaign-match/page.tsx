import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import {
  DISCOVERY_PAGE_IDENTITY,
  DiscoveryPageHeader,
} from "@/features/discovery/components/discovery-page-identity";

export default function DiscoveryCampaignMatchPage() {
  return (
    <DashboardShell
      title="Campaign Match"
      description="Match discovered creators to campaign briefs."
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/campaign-match" />
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 md:p-4">
            <DiscoveryPageHeader identity={DISCOVERY_PAGE_IDENTITY["campaign-match"]} />
            <section className="space-y-3 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                AI-powered campaign brief matching is coming in a later discovery phase. Use Creator
                Search and shortlists while this workspace is being built.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                  <Link href="/discovery/search">Creator Search</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/discovery">Discovery hub</Link>
                </Button>
              </div>
            </section>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
