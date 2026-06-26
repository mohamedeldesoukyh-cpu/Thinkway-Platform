import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";

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
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <section className="space-y-4 rounded-3xl border border-dashed border-border px-6 py-16 text-center">
              <h2 className="font-heading text-2xl font-semibold tracking-tight">Campaign Match</h2>
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
