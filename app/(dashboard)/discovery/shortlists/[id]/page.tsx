import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DiscoveryPageShell } from "@/features/discovery/components/discovery-page-shell";
import { ShortlistWorkspace } from "@/features/discovery/shortlists/components/shortlist-workspace";
import {
  getShortlistBrandOptions,
  getShortlistCampaignOptions,
  getShortlistClientOptions,
  getShortlistDetail,
} from "@/features/discovery/shortlists/queries";
import { seedFromShortlist } from "@/features/campaign-outputs/hydration/seed-adapters";
import { shortlistDetailPath } from "@/lib/routing/entity-paths";
import {
  metadataTitleForEntity,
  redirectToCanonicalEntityRoute,
} from "@/lib/routing/entity-page";
import {
  fetchShortlistRouteSummary,
  resolveShortlistIdByRouteKey,
} from "@/lib/routing/entity-route-queries";

type ShortlistDetailPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: Pick<ShortlistDetailPageProps, "params">): Promise<Metadata> {
  const { id: routeKey } = await params;
  const shortlistId = await resolveShortlistIdByRouteKey(routeKey);
  if (!shortlistId) return { title: "Shortlist" };

  const summary = await fetchShortlistRouteSummary(shortlistId);
  if (!summary) return { title: "Shortlist" };

  return {
    title: metadataTitleForEntity(summary, summary.serial_number),
  };
}

export default async function ShortlistDetailPage({ params }: ShortlistDetailPageProps) {
  const { id: routeKey } = await params;

  const shortlistId = await resolveShortlistIdByRouteKey(routeKey);
  if (!shortlistId) notFound();

  const routeSummary = await fetchShortlistRouteSummary(shortlistId);
  const canonicalPath = routeSummary
    ? shortlistDetailPath({
        id: routeSummary.id,
        slug: routeSummary.slug,
        name: routeSummary.name,
        serial_number: routeSummary.serial_number ?? null,
      })
    : shortlistDetailPath(shortlistId);

  if (routeSummary) {
    redirectToCanonicalEntityRoute({
      routeKey,
      entity: {
        ...routeSummary,
        serial_number: routeSummary.serial_number ?? null,
      },
      canonicalPath,
    });
  }

  const detail = await getShortlistDetail(shortlistId);
  if (!detail) notFound();

  const [campaigns, brands, clients] = await Promise.all([
    getShortlistCampaignOptions(),
    getShortlistBrandOptions(),
    getShortlistClientOptions(),
  ]);

  const seed = seedFromShortlist(detail);

  return (
    <DiscoveryPageShell
      page="shortlists"
      activeHref={canonicalPath}
      variant="flush"
      showHeader={false}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        <ShortlistWorkspace
          detail={detail}
          seed={seed}
          campaigns={campaigns}
          brands={brands}
          clients={clients}
        />
      </div>
    </DiscoveryPageShell>
  );
}
