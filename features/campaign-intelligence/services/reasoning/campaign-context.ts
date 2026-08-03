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
  strategy?: CampaignStrategyDocument | null
): Is1CampaignContext {
  const understanding = strategy?.understanding;
  const industry =
    facts.industry ??
    understanding?.industry ??
    detectIndustryFromBrief(facts.rawBriefExcerpt ?? strategy?.narrative);

  const brand =
    cleanBrandLabel(facts.brandName) ??
    cleanBrandLabel(understanding?.brand) ??
    cleanBrandLabel(facts.clientName) ??
    "the brand";

  const geography =
    cleanGeographyLabel(facts.geography?.join(", ")) ??
    cleanGeographyLabel(understanding?.geography) ??
    "the primary market";

  return {
    brand,
    client: cleanBrandLabel(facts.clientName) ?? cleanBrandLabel(understanding?.client),
    industry,
    objective: facts.objective ?? understanding?.objective ?? "campaign objectives",
    audience: facts.audience ?? understanding?.audience ?? "brand-relevant consumers",
    geography,
    platforms: facts.platforms ?? understanding?.platforms ?? [],
    budgetAmount: facts.budget?.amount ?? understanding?.budget?.amount,
    budgetCurrency:
      facts.budget?.currency ?? understanding?.budget?.currency ?? "USD",
    durationWeeks:
      facts.durationWeeks ?? understanding?.timeline?.durationWeeks ?? 6,
    constraints: facts.constraints?.length
      ? facts.constraints
      : understanding?.constraints ?? [],
    risks: facts.risks?.length ? facts.risks : understanding?.risks ?? [],
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
  const brand = facts.brandName?.trim() || "the brand";
  const objective = facts.objective?.trim() || "the stated objective";
  return `Brief evidence — ${brand}; objective ${objective}; budget ${budget}`;
}
