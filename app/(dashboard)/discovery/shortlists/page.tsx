import Link from "next/link";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { CreateShortlistDialog } from "@/features/discovery/shortlists/components/create-shortlist-dialog";
import { ShortlistsList } from "@/features/discovery/shortlists/components/shortlists-list";
import {
  getDiscoveryShortlistsV2,
  getShortlistBrandOptions,
} from "@/features/discovery/shortlists/queries";
import type {
  ShortlistBrandOption,
  ShortlistListRow,
} from "@/features/discovery/shortlists/types";

export default async function DiscoveryShortlistsPage() {
  let shortlists: ShortlistListRow[] = [];
  let brands: ShortlistBrandOption[] = [];
  let errorMessage: string | null = null;

  try {
    [shortlists, brands] = await Promise.all([
      getDiscoveryShortlistsV2(),
      getShortlistBrandOptions(),
    ]);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load shortlists.";
  }

  return (
    <DashboardShell
      title="Discovery Shortlists"
      description="Reviewable, approvable creator shortlists with full movement audit."
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/shortlists" />
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
            <section className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h2 className="font-heading text-2xl font-semibold tracking-tight">
                  Shortlists
                </h2>
                <p className="text-sm text-muted-foreground">
                  Build, review, approve, and move creators into campaigns.
                </p>
              </div>
              <CreateShortlistDialog brands={brands} />
            </section>

            {errorMessage ? (
              <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : shortlists.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border px-6 py-16 text-center">
                <p className="text-sm font-medium">No shortlists yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a shortlist, then add creators from Search or Compare.
                </p>
                <Button asChild className="mt-4" variant="secondary">
                  <Link href="/discovery/search">Open Creator Search</Link>
                </Button>
              </div>
            ) : (
              <ShortlistsList shortlists={shortlists} />
            )}
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
