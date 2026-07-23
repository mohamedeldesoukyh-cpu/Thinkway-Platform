import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { SearchCreatorCardItem } from "@/features/campaign-studio/services/creator-platform-utils";
import {
  computeCampaignForecastFromProfiles,
  defaultDeliverableForPlatform,
  forecastToGroundedKpis,
  searchCardsToForecastProfiles,
  toCampaignForecastSnapshot,
  type CampaignForecast,
} from "@/lib/campaign-forecast";

/** Compute roster forecast for Campaign Studio slate cards via unified profiles. */
export function computeStudioCampaignForecast(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
}): CampaignForecast {
  const campaignPlatform = input.facts?.platforms?.[0] ?? input.cards[0]?.platform ?? null;
  const defaultDeliverable = campaignPlatform
    ? defaultDeliverableForPlatform(campaignPlatform)
    : undefined;

  const profiles = searchCardsToForecastProfiles(input.cards, {
    defaultDeliverable,
  });

  return computeCampaignForecastFromProfiles(profiles, { campaignPlatform });
}

export function studioForecastArtifacts(input: {
  cards: SearchCreatorCardItem[];
  facts?: CampaignFacts;
}): {
  forecast: CampaignForecast;
  snapshot: ReturnType<typeof toCampaignForecastSnapshot>;
  groundedKpis: ReturnType<typeof forecastToGroundedKpis>;
} {
  const forecast = computeStudioCampaignForecast(input);
  return {
    forecast,
    snapshot: toCampaignForecastSnapshot(forecast),
    groundedKpis: forecastToGroundedKpis(forecast),
  };
}
