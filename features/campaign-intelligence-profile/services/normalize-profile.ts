import type { CampaignIntelligenceProfile } from "../types/profile";
import { createEmptyCampaignIntelligenceProfile } from "../types/profile";
import { validatedFromNormalizedEntities } from "../types/validated-intelligence";
import { normalizeFromProfile } from "./normalization";

/** Normalize profile jsonb from Supabase (object or string). */
export function normalizeCampaignIntelligenceProfile(
  raw: unknown
): CampaignIntelligenceProfile {
  if (!raw) return createEmptyCampaignIntelligenceProfile();
  if (typeof raw === "string") {
    try {
      return normalizeCampaignIntelligenceProfile(JSON.parse(raw));
    } catch {
      return createEmptyCampaignIntelligenceProfile();
    }
  }
  if (typeof raw !== "object") return createEmptyCampaignIntelligenceProfile();
  const obj = raw as CampaignIntelligenceProfile;
  const profile: CampaignIntelligenceProfile = {
    ...createEmptyCampaignIntelligenceProfile(),
    ...obj,
    objectives: obj.objectives ?? [],
    creatorCategories: obj.creatorCategories ?? [],
    creatorNiches: obj.creatorNiches ?? [],
    deliverables: obj.deliverables ?? [],
    kpis: obj.kpis ?? [],
    platforms: obj.platforms ?? [],
    confidence: obj.confidence ?? {},
    sources: obj.sources ?? {},
    validatedIntelligence:
      obj.validatedIntelligence ??
      (obj.normalizedEntities
        ? validatedFromNormalizedEntities(obj.normalizedEntities)
        : undefined),
    normalizedEntities: obj.normalizedEntities,
    extractionIssues: obj.extractionIssues ?? [],
    fieldProvenance: obj.fieldProvenance,
    structuredBrief: obj.structuredBrief,
    pipelineDebug: obj.pipelineDebug,
  };

  if (profileHasExtractedData(profile)) {
    const normalized = normalizeFromProfile(profile).profile;
    return {
      ...normalized,
      structuredBrief: obj.structuredBrief ?? profile.structuredBrief,
      pipelineDebug: obj.pipelineDebug ?? profile.pipelineDebug,
    };
  }

  return profile;
}

export function profileHasExtractedData(profile: CampaignIntelligenceProfile): boolean {
  return Boolean(
    profile.brandName?.trim() ||
      profile.campaignName?.trim() ||
      profile.market?.trim() ||
      profile.campaignType?.trim() ||
      profile.audience?.trim() ||
      profile.industry?.trim() ||
      (profile.objectives?.length ?? 0) > 0 ||
      (profile.creatorCategories?.length ?? 0) > 0 ||
      (profile.platforms?.length ?? 0) > 0 ||
      (profile.deliverables?.length ?? 0) > 0 ||
      (profile.kpis?.length ?? 0) > 0 ||
      profile.budget?.amount
  );
}
