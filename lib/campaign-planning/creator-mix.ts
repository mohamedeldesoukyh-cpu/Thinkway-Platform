import { buildCreatorMixFromFacts } from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";

import type { CampaignPlanningBrief, CampaignPlanningInput, CreatorMixStrategy } from "./types";

function objectiveKey(objective?: string | null): string {
  const text = (objective ?? "").toLowerCase();
  if (text.includes("awareness")) return "awareness";
  if (text.includes("engagement")) return "engagement";
  if (text.includes("conversion") || text.includes("sales")) return "conversion";
  if (text.includes("launch")) return "launch";
  if (text.includes("reach")) return "reach";
  return "awareness";
}

function budgetToCreatorCount(budget?: number | null): number {
  if (!budget || budget <= 0) return 6;
  if (budget < 50_000) return 4;
  if (budget < 150_000) return 6;
  if (budget < 400_000) return 10;
  if (budget < 1_000_000) return 14;
  return 18;
}

function factsFromBrief(brief: CampaignPlanningBrief): CampaignFacts {
  return {
    objective: brief.objective ?? undefined,
    industry: brief.industry ?? undefined,
    brandName: brief.brandName ?? undefined,
    budget: brief.budget?.amount
      ? { amount: brief.budget.amount, currency: brief.budget.currency ?? "USD" }
      : undefined,
    durationWeeks: brief.durationWeeks ?? undefined,
    geography: brief.geography ?? [],
    audience: brief.audience ?? undefined,
    platforms: brief.platforms ?? [],
    deliverables: brief.deliverables ?? [],
    constraints: brief.constraints ?? [],
    kpis: brief.kpis ?? [],
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
}

function scaleMixToCount(mix: CreatorMixTier[], totalCreators: number): CreatorMixTier[] {
  const withCounts = mix.map((tier) => ({
    ...tier,
    count: Math.max(1, Math.round((tier.percent / 100) * totalCreators)),
  }));
  const assigned = withCounts.reduce((sum, tier) => sum + tier.count, 0);
  if (assigned !== totalCreators && withCounts.length) {
    withCounts[0]!.count += totalCreators - assigned;
  }
  return withCounts;
}

function adjustMixForObjective(mix: CreatorMixTier[], objective: string): CreatorMixTier[] {
  if (objective === "engagement") {
    return mix.map((tier) =>
      tier.tier === "Micro" || tier.tier === "Nano"
        ? { ...tier, percent: tier.percent + 5, reasoning: `${tier.reasoning} Engagement objective favors micro/nano efficiency.` }
        : tier.tier === "Macro" || tier.tier === "Mega"
          ? { ...tier, percent: Math.max(5, tier.percent - 5) }
          : tier
    );
  }
  if (objective === "awareness" || objective === "launch") {
    return mix.map((tier) =>
      tier.tier === "Macro" || tier.tier === "Mega" || tier.tier === "Celebrity"
        ? { ...tier, percent: tier.percent + 5, reasoning: `${tier.reasoning} Awareness/launch objectives benefit from anchor creators.` }
        : tier
    );
  }
  return mix;
}

export function buildCreatorMixStrategy(input: CampaignPlanningInput): CreatorMixStrategy {
  const brief = input.brief;
  const facts = factsFromBrief(brief);
  const industry = detectIndustryFromBrief(facts.industry ?? facts.brandName ?? "");
  const objective = objectiveKey(brief.objective);
  const totalCreators = budgetToCreatorCount(brief.budget?.amount);

  let tiers = buildCreatorMixFromFacts(facts);
  tiers = adjustMixForObjective(tiers, objective);
  tiers = scaleMixToCount(tiers, totalCreators);

  const influencedBy = [
    brief.objective ? `Objective: ${brief.objective}` : "Default awareness objective",
    industry ? `Industry: ${industry}` : "General industry mix",
    brief.budget?.amount ? `Budget: ${brief.budget.amount.toLocaleString()} ${brief.budget.currency ?? ""}` : "Budget not specified — default roster size",
  ];

  return {
    totalCreators,
    tiers,
    recommendations: tiers.map((tier) => ({
      label: `${tier.tier} tier`,
      value: `${tier.count} creators (${tier.percent}%)`,
      reasoning: [tier.reasoning],
      influencedBy,
      constraintsApplied: brief.constraints ?? [],
      principlesUsed: [
        "Optimization Engine creator-mix balance principle",
        "Forecast Engine tier reach/engagement trade-offs",
      ],
    })),
  };
}

export { budgetToCreatorCount, objectiveKey, factsFromBrief };
