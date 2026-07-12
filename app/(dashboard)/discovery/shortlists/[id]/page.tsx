import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { ShortlistWorkspace } from "@/features/discovery/shortlists/components/shortlist-workspace";
import {
  getShortlistBrandOptions,
  getShortlistCampaignOptions,
  getShortlistDetail,
} from "@/features/discovery/shortlists/queries";
import { GenerateOutputsLauncher } from "@/features/campaign-outputs/components/generate-outputs-launcher";
import { seedFromShortlist } from "@/features/campaign-outputs/hydration/seed-adapters";

export default async function ShortlistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const detail = await getShortlistDetail(id);
  if (!detail) notFound();

  const [campaigns, brands] = await Promise.all([
    getShortlistCampaignOptions(),
    getShortlistBrandOptions(),
  ]);

  return (
    <DashboardShell
      title={detail.name}
      description={detail.serial_number ?? "Shortlist"}
      hidePageHeader
      containedMain
      mainClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <PlatformErrorBoundary surface="generic">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          <DiscoverySubNav activeHref="/discovery/shortlists" />
          <div className="min-h-0 flex-1 overflow-y-auto bg-muted/30">
            <div className="mx-auto w-full max-w-[1800px] px-5 py-6 sm:px-8">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <Link
                  href="/discovery/shortlists"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeftIcon className="size-3.5" strokeWidth={2} />
                  Back to shortlists
                </Link>
                <GenerateOutputsLauncher
                  seed={seedFromShortlist(detail)}
                  tab="outputs"
                  workspace={{ type: "shortlist", id: detail.id }}
                  className="w-full max-w-md sm:w-auto"
                />
              </div>
              <ShortlistWorkspace detail={detail} campaigns={campaigns} brands={brands} />
            </div>
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
