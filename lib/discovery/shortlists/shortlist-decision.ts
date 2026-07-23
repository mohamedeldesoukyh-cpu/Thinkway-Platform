import { computeCampaignForecastFromProfiles, shortlistGroupsToForecastProfiles } from "@/lib/campaign-forecast";
import { optimizeShortlistCampaign } from "@/lib/discovery/shortlists/shortlist-optimization";
import { evaluateCampaignDecision, type CampaignDecisionReport } from "@/lib/campaign-decision";

type ShortlistCreatorGroup = {
  creatorKey: string;
  creator: string;
  handle: string;
  followersNumeric: number | null;
  engagementRateNumeric: number | null;
  platformLinks: Array<{ platform: string }>;
};

export function evaluateShortlistDecision(
  groups: ShortlistCreatorGroup[]
): CampaignDecisionReport {
  const forecast = computeCampaignForecastFromProfiles(shortlistGroupsToForecastProfiles(groups), {
    campaignPlatform: groups[0]?.platformLinks[0]?.platform ?? null,
  });
  const optimization = optimizeShortlistCampaign(groups);

  return evaluateCampaignDecision({
    forecast,
    optimization,
    configuration: {
      platforms: groups[0]?.platformLinks.map((p) => p.platform) ?? [],
    },
  });
}
