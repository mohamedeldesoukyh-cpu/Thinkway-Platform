import { computeCampaignForecastFromProfiles, shortlistGroupsToForecastProfiles } from "@/lib/campaign-forecast";
import { optimizeCampaign, type CampaignOptimizationReport } from "@/lib/campaign-optimization";

type ShortlistCreatorGroup = {
  creatorKey: string;
  creator: string;
  handle: string;
  followersNumeric: number | null;
  engagementRateNumeric: number | null;
  platformLinks: Array<{ platform: string }>;
};

/** Run optimization analysis for a shortlist roster. */
export function optimizeShortlistCampaign(
  groups: ShortlistCreatorGroup[],
  context?: { campaignPlatform?: string | null }
): CampaignOptimizationReport {
  const forecast = computeCampaignForecastFromProfiles(shortlistGroupsToForecastProfiles(groups), {
    campaignPlatform: context?.campaignPlatform ?? groups[0]?.platformLinks[0]?.platform ?? null,
  });

  return optimizeCampaign({
    forecast,
    context: {
      campaignPlatform: context?.campaignPlatform ?? groups[0]?.platformLinks[0]?.platform ?? null,
    },
  });
}
