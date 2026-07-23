import {
  BUDGET_CONTINGENCY_SHARE,
  BUDGET_CREATOR_FEE_SHARE,
  BUDGET_PRODUCTION_SHARE,
} from "./config";
import type {
  BudgetStrategy,
  CampaignPlanningInput,
  CreatorMixStrategy,
  DeliverableStrategy,
  PlatformStrategy,
} from "./types";

function line(
  category: string,
  amount: number,
  percent: number,
  expectedImpact: string,
  reasoning: string[]
) {
  return { category, amount, percent, expectedImpact, reasoning };
}

export function buildBudgetStrategy(
  input: CampaignPlanningInput,
  creatorMix: CreatorMixStrategy,
  platformStrategy: PlatformStrategy,
  deliverableStrategy: DeliverableStrategy
): BudgetStrategy {
  const totalBudget = input.brief.budget?.amount ?? 100_000;
  const currency = input.brief.budget?.currency ?? "USD";

  const creatorPool = totalBudget * BUDGET_CREATOR_FEE_SHARE;
  const productionPool = totalBudget * BUDGET_PRODUCTION_SHARE;
  const contingencyPool = totalBudget * BUDGET_CONTINGENCY_SHARE;

  const creatorTierAllocations = creatorMix.tiers.map((tier) => {
    const percent = tier.percent * BUDGET_CREATOR_FEE_SHARE * 0.01;
    return line(
      `${tier.tier} creators`,
      Math.round(totalBudget * percent),
      Math.round(percent * 100),
      `Expected ${tier.percent}% of roster reach from ${tier.tier} tier.`,
      [tier.reasoning, "Budget follows optimization cost-efficiency principle."]
    );
  });

  const platformAllocations = platformStrategy.platforms.map((platform) =>
    line(
      `${platform.platform} platform`,
      Math.round(totalBudget * (platform.budgetPercent / 100) * BUDGET_CREATOR_FEE_SHARE),
      Math.round(platform.budgetPercent * BUDGET_CREATOR_FEE_SHARE),
      `Supports ${platform.creatorPercent}% of creator roster on ${platform.platform}.`,
      platform.reasoning
    )
  );

  const deliverableTotalUnits = deliverableStrategy.mix.reduce((sum, item) => sum + item.quantity, 0);
  const deliverableAllocations = deliverableStrategy.mix.map((item) => {
    const share = item.quantity / Math.max(deliverableTotalUnits, 1);
    return line(
      item.contentType,
      Math.round(creatorPool * share * 0.85),
      Math.round(share * BUDGET_CREATOR_FEE_SHARE * 85),
      `Funds ${item.quantity} ${item.contentType} deliverables.`,
      item.reasoning
    );
  });

  const productionAndContingency = [
    line("Production", Math.round(productionPool), Math.round(BUDGET_PRODUCTION_SHARE * 100), "Creative production and asset adaptation.", ["Standard 18% production reserve."]),
    line("Contingency", Math.round(contingencyPool), Math.round(BUDGET_CONTINGENCY_SHARE * 100), "Buffer for creator swaps and boost spend.", ["Decision Engine risk mitigation reserve."]),
  ];

  return {
    totalBudget,
    currency,
    creatorTierAllocations,
    platformAllocations,
    deliverableAllocations,
    productionAndContingency,
    expectedRoiNarrative:
      "Creator fees prioritized (72%) for forecast reach; production and contingency protect deliverable quality and launch flexibility.",
    recommendations: [
      {
        label: "Creator fee pool",
        value: `${Math.round(BUDGET_CREATOR_FEE_SHARE * 100)}% of budget`,
        reasoning: ["Creator fees drive forecast reach and engagement KPIs."],
        influencedBy: [input.brief.objective ?? "awareness"],
        constraintsApplied: input.brief.constraints ?? [],
        principlesUsed: ["Optimization budget efficiency", "Forecast impressions per budget unit"],
      },
    ],
  };
}
