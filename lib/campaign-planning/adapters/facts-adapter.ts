import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import type { CampaignPlanningBrief, CampaignPlanningInput } from "../types";

export function campaignFactsToPlanningBrief(facts: CampaignFacts): CampaignPlanningBrief {
  return {
    objective: facts.objective ?? null,
    industry: facts.industry ?? null,
    brandName: facts.brandName ?? null,
    campaignType: facts.campaignType ?? null,
    budget: facts.budget,
    durationWeeks: facts.durationWeeks ?? null,
    geography: facts.geography ?? [],
    audience: facts.audience ?? null,
    platforms: facts.platforms ?? [],
    deliverables: facts.deliverables ?? [],
    constraints: facts.constraints ?? [],
    kpis: facts.kpis ?? [],
  };
}

export function campaignFactsToPlanningInput(facts: CampaignFacts): CampaignPlanningInput {
  return { brief: campaignFactsToPlanningBrief(facts) };
}
