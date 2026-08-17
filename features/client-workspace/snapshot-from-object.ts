import { deriveEnterprisePlanningNarrative } from "@/features/campaign-studio/services/planning-narrative";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import type { ClientCreatorSelectionState } from "./constants";
import {
  clientCreatorIds,
  projectClientCommercial,
  projectClientContent,
  projectClientCreators,
  projectClientOverview,
  projectClientTimeline,
} from "./project-client-view";
import type { ClientCreatorCard, ClientReviewSourceSnapshot } from "./types";

function snapshotCreatorCard(card: ClientCreatorCard): ClientReviewSourceSnapshot["creators"][number] {
  return {
    creatorId: card.creatorId,
    displayName: card.displayName,
    handle: card.handle,
    platform: card.platform,
    followers: card.followers,
    engagementRate: card.engagementRate,
    country: card.country,
    city: card.city,
    category: card.category,
    audienceHighlight: card.audienceHighlight,
    fitExplanation: card.fitExplanation,
    deliverables: card.deliverables,
    investmentAmount: card.investmentAmount,
    investmentCurrency: card.investmentCurrency,
    avatarUrl: card.avatarUrl,
    bio: card.bio,
  };
}

export function snapshotFromCampaignObject(
  campaignObject: CampaignObject,
  selection: Record<string, ClientCreatorSelectionState>,
  hydrated: UnifiedCreatorResult[] = []
): ClientReviewSourceSnapshot {
  const overview = projectClientOverview(campaignObject, selection);
  const creators = projectClientCreators(campaignObject, selection, hydrated);
  const narrative = deriveEnterprisePlanningNarrative(campaignObject);
  return {
    source: "studio",
    brandName: overview.brandName,
    campaignName: overview.campaignName,
    clientLabel: overview.clientLabel,
    objective: overview.objective,
    audience: overview.audience,
    market: overview.market,
    durationLabel: overview.durationLabel,
    platforms: overview.platforms,
    deliverables: overview.deliverables,
    whyThisApproach: overview.whyThisApproach,
    strategyBody: [narrative.recommendedBusinessDecision, narrative.campaignStrategy]
      .filter((part) => part && !/^insufficient/i.test(part))
      .join("\n\n")
      .slice(0, 4000),
    creators: creators.map(snapshotCreatorCard),
    content: projectClientContent(campaignObject),
    timeline: projectClientTimeline(campaignObject),
    commercial: projectClientCommercial(campaignObject, selection),
    creatorIds: clientCreatorIds(campaignObject),
  };
}
