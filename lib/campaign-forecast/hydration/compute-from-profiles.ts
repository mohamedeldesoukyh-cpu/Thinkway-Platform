import { computeCampaignForecast } from "../campaign-forecast-engine";
import type { CampaignForecast, CampaignForecastInput } from "../types";
import type { CreatorForecastProfile } from "../profile/types";
import { profilesToForecastCreatorInputs, profileToForecastCreatorInput } from "./profile-to-forecast-input";

/** Run campaign forecast from normalized profiles — single hydration path. */
export function computeCampaignForecastFromProfiles(
  profiles: CreatorForecastProfile[],
  input?: Pick<CampaignForecastInput, "campaignPlatform" | "overlapConfig">
): CampaignForecast {
  return computeCampaignForecast({
    creators: profilesToForecastCreatorInputs(profiles),
    campaignPlatform: input?.campaignPlatform,
    overlapConfig: input?.overlapConfig,
  });
}

export function computeCampaignForecastFromProfile(
  profile: CreatorForecastProfile,
  input?: Pick<CampaignForecastInput, "campaignPlatform" | "overlapConfig">
): CampaignForecast {
  return computeCampaignForecastFromProfiles([profile], input);
}

export { profileToForecastCreatorInput, profilesToForecastCreatorInputs };
