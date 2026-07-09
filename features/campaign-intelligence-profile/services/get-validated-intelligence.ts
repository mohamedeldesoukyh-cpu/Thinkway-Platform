import type { CampaignIntelligenceProfile } from "../types/profile";
import type { ValidatedCampaignIntelligence } from "../types/validated-intelligence";
import { validatedFromNormalizedEntities } from "../types/validated-intelligence";

/** Resolve SSOT validated intelligence — never fall back to raw extraction fields. */
export function getValidatedIntelligence(
  profile: CampaignIntelligenceProfile
): ValidatedCampaignIntelligence | undefined {
  if (profile.validatedIntelligence) {
    return profile.validatedIntelligence;
  }
  if (profile.normalizedEntities) {
    return validatedFromNormalizedEntities(profile.normalizedEntities);
  }
  return undefined;
}

export function hasValidatedIntelligence(profile: CampaignIntelligenceProfile): boolean {
  const v = getValidatedIntelligence(profile);
  if (!v) return false;
  return Boolean(
    v.brand.brandName ||
      v.market.countryCode ||
      v.audience.countries.length ||
      v.platforms.length ||
      v.categories.length ||
      v.creator.niches.length ||
      v.keywords.length
  );
}
