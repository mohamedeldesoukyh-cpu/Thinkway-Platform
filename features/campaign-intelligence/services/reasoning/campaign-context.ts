import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";

export type Is1CampaignContext = {
  brand: string;
  client?: string;
  industry: string;
  objective: string;
  audience: string;
  geography: string;
  platforms: string[];
  budgetAmount?: number;
  budgetCurrency: string;
  durationWeeks: number;
  constraints: string[];
  risks: string[];
};

export function buildIs1CampaignContext(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): Is1CampaignContext {
  const industry =
    facts.industry ??
    strategy.understanding.industry ??
    detectIndustryFromBrief(facts.rawBriefExcerpt ?? strategy.narrative);

  return {
    brand: facts.brandName ?? strategy.understanding.brand,
    client: facts.clientName ?? strategy.understanding.client,
    industry,
    objective: facts.objective ?? strategy.understanding.objective,
    audience: facts.audience ?? strategy.understanding.audience,
    geography:
      facts.geography?.join(", ") ??
      strategy.understanding.geography ??
      "Primary market per brief",
    platforms: facts.platforms ?? strategy.understanding.platforms,
    budgetAmount: facts.budget?.amount ?? strategy.understanding.budget?.amount,
    budgetCurrency:
      facts.budget?.currency ?? strategy.understanding.budget?.currency ?? "USD",
    durationWeeks:
      facts.durationWeeks ?? strategy.understanding.timeline?.durationWeeks ?? 6,
    constraints:
      facts.constraints?.length
        ? facts.constraints
        : strategy.understanding.constraints,
    risks: facts.risks?.length ? facts.risks : strategy.understanding.risks,
  };
}

export function formatBudgetRef(ctx: Is1CampaignContext): string {
  if (ctx.budgetAmount == null) return "budget TBD per CampaignFacts";
  return `${ctx.budgetCurrency} ${ctx.budgetAmount.toLocaleString()}`;
}

export function factsEvidenceRef(facts: CampaignFacts): string {
  const budget =
    facts.budget?.amount != null
      ? `${facts.budget.currency} ${facts.budget.amount.toLocaleString()}`
      : "TBD";
  return `CampaignFacts[brand=${facts.brandName}, objective=${facts.objective ?? "n/a"}, budget=${budget}]`;
}
