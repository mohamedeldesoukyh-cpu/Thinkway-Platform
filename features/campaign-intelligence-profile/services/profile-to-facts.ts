import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { validateCampaignFacts } from "@/features/campaign-director/facts/validate-campaign-facts";

import type { CampaignIntelligenceProfile } from "../types/profile";

/** Bridge CIP → legacy CampaignFacts consumers (Director, Studio sections). */
export function profileToCampaignFacts(
  profile: CampaignIntelligenceProfile
): CampaignFacts {
  const facts: CampaignFacts = {
    clientName: profile.clientName,
    brandName: profile.brandName,
    industry: profile.industry,
    campaignType: profile.campaignType ?? profile.campaignName,
    objective:
      profile.objective ??
      profile.objectives?.[0] ??
      profile.campaignName,
    budget: profile.budget,
    durationWeeks: profile.durationWeeks,
    geography:
      profile.geography ??
      profile.audienceDetail?.countries ??
      (profile.market ? [profile.market] : undefined),
    audience: profile.audience,
    platforms: profile.platforms,
    kpis: profile.kpis,
    constraints: [
      ...(profile.requirements?.mandatory ?? []),
      ...(profile.constraints ?? []),
    ].filter(Boolean),
    risks: profile.risks,
    rawBriefExcerpt: profile.rawBriefExcerpt,
    extractedAt: profile.extractedAt,
    confidence: { ...profile.confidence },
    sources: { ...profile.sources },
  };

  return validateCampaignFacts(facts);
}

export function campaignFactsToProfilePatch(
  facts: CampaignFacts
): Partial<CampaignIntelligenceProfile> {
  return {
    ...facts,
    schemaVersion: 1,
    status: "saved",
  };
}
