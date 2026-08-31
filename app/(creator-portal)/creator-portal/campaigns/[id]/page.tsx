import { notFound } from "next/navigation";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { overlayCreatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-card-model";
import { CreatorCampaignWorkspace } from "@/features/creator-workspace/components/creator-campaign-workspace";
import { loadCreatorUnitViews } from "@/features/creator-workspace/documentation-load";
import {
  getCreatorCampaignDetail,
  getCreatorCampaigns,
  getCreatorPayments,
  getCreatorPublications,
} from "@/features/portals/queries";
import { upcomingUnitsFromViews } from "@/lib/creator-insights/presentation";
import { loadOwnCreatorInsightPack } from "@/lib/creator-insights/service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CreatorCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const [detail, units, campaigns, payments, publications] = await Promise.all([
    getCreatorCampaignDetail(id),
    loadCreatorUnitViews(),
    getCreatorCampaigns(),
    getCreatorPayments(),
    getCreatorPublications(),
  ]);

  if (!detail) {
    notFound();
  }

  const campaignUnits = units.filter((unit) => unit.campaignHeaderId === id);
  const insightPack = await loadOwnCreatorInsightPack(upcomingUnitsFromViews(campaignUnits));
  const overlayed = overlayCreatorCampaignUnitCounts(campaigns, units);
  const campaignRow = overlayed.find((row) => row.campaign_header_id === id) ?? null;
  const payment = payments.find((row) => row.campaign_header_id === id) ?? null;
  const campaignPublications = publications.filter((row) => row.campaign_header_id === id);

  return (
    <PlatformErrorBoundary surface="generic">
      <CreatorCampaignWorkspace
        detail={detail}
        units={campaignUnits}
        payment={payment}
        publications={campaignPublications}
        insightPack={insightPack}
        campaignRow={campaignRow}
      />
    </PlatformErrorBoundary>
  );
}
