import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { detectIndustryFromBrief } from "@/features/campaign-studio/services/industry-intelligence";
import {
  countryLabel,
  isValidBrandName,
  resolveCountryCode,
  sanitizeBrandName,
} from "@/features/campaign-intelligence-profile/services/normalization/validators";

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

function cleanBrandLabel(value: string | undefined | null): string | undefined {
  if (!value?.trim()) return undefined;
  if (/\bplease\s+(search|find|build)\b/i.test(value)) return undefined;
  const sanitized = sanitizeBrandName(value);
  return isValidBrandName(sanitized) ? sanitized : undefined;
}

function cleanGeographyLabel(value: string | undefined | null): string | undefined {
  if (!value?.trim()) return undefined;
  const parts = value
    .split(",")
    .map((part) => {
      const code = resolveCountryCode(part.trim());
      return code ? countryLabel(code) : null;
    })
    .filter((part): part is string => Boolean(part));
  if (parts.length === 0) return undefined;
  return [...new Set(parts)].join(", ");
}

export function buildIs1CampaignContext(
  facts: CampaignFacts,
  strategy: CampaignStrategyDocument
): Is1CampaignContext {
  const industry =
    facts.industry ??
    strategy.understanding.industry ??
    detectIndustryFromBrief(facts.rawBriefExcerpt ?? strategy.narrative);

  const brand =
    cleanBrandLabel(facts.brandName) ??
    cleanBrandLabel(strategy.understanding.brand) ??
    cleanBrandLabel(facts.clientName) ??
    "the brand";

  const geography =
    cleanGeographyLabel(facts.geography?.join(", ")) ??
    cleanGeographyLabel(strategy.understanding.geography) ??
    "the primary market";

  return {
    brand,
    client: cleanBrandLabel(facts.clientName) ?? cleanBrandLabel(strategy.understanding.client),
    industry,
    objective: facts.objective ?? strategy.understanding.objective,
    audience: facts.audience ?? strategy.understanding.audience,
    geography,
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
  if (ctx.budgetAmount == null) return "budget TBD per the campaign brief";
  return `${ctx.budgetCurrency} ${ctx.budgetAmount.toLocaleString()}`;
}

export function factsEvidenceRef(facts: CampaignFacts): string {
  const budget =
    facts.budget?.amount != null
      ? `${facts.budget.currency} ${facts.budget.amount.toLocaleString()}`
      : "TBD";
  return `CampaignFacts[brand=${facts.brandName}, objective=${facts.objective ?? "n/a"}, budget=${budget}]`;
}
