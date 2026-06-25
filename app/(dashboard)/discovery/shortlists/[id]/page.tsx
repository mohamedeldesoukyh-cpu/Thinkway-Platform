import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Button } from "@/components/ui/button";
import { DiscoverySubNav } from "@/features/discovery-import/components/discovery-sub-nav";
import { ShortlistWorkspace } from "@/features/discovery/shortlists/components/shortlist-workspace";
import {
  getShortlistBrandOptions,
  getShortlistCampaignOptions,
  getShortlistDetail,
} from "@/features/discovery/shortlists/queries";

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
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            <Button asChild variant="ghost" size="sm" className="mb-4">
              <Link href="/discovery/shortlists">← Back to shortlists</Link>
            </Button>
            <ShortlistWorkspace detail={detail} campaigns={campaigns} brands={brands} />
          </div>
        </div>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
