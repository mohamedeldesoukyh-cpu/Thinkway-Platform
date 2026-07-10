import {
  clampCampaignDurationWeeks,
  DEFAULT_CAMPAIGN_DURATION_WEEKS,
} from "@/features/campaign-studio/services/timeline-duration";

import type { CampaignFacts } from "./campaign-facts-types";

const VALID_CURRENCIES = new Set(["USD", "EGP", "AED", "SAR", "EUR", "GBP"]);

function normalizeCurrency(currency: string): string {
  const code = currency.trim().toUpperCase();
  return VALID_CURRENCIES.has(code) ? code : "USD";
}

/** Validate and normalize extracted facts — clamp defaults, enforce positive budget. */
export function validateCampaignFacts(facts: CampaignFacts): CampaignFacts {
  const validated: CampaignFacts = {
    ...facts,
    confidence: { ...facts.confidence },
    sources: { ...facts.sources },
  };

  if (validated.budget) {
    const amount = Math.round(validated.budget.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      delete validated.budget;
      delete validated.confidence.budget;
      delete validated.sources.budget;
    } else {
      validated.budget = {
        amount,
        currency: normalizeCurrency(validated.budget.currency),
      };
    }
  }

  if (validated.durationWeeks !== undefined) {
    validated.durationWeeks = clampCampaignDurationWeeks(validated.durationWeeks);
  } else {
    validated.durationWeeks = DEFAULT_CAMPAIGN_DURATION_WEEKS;
    validated.confidence.durationWeeks = validated.confidence.durationWeeks ?? 0.4;
    validated.sources.durationWeeks = validated.sources.durationWeeks ?? "default";
  }

  if (validated.geography) {
    validated.geography = validated.geography
      .map((g) => g.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (validated.geography.length === 0) delete validated.geography;
  }

  if (validated.platforms) {
    validated.platforms = [...new Set(validated.platforms.map((p) => p.trim()).filter(Boolean))];
  }

  if (validated.kpis) {
    validated.kpis = validated.kpis.map((k) => k.trim()).filter(Boolean);
  }

  if (validated.deliverables) {
    validated.deliverables = validated.deliverables.map((d) => d.trim()).filter(Boolean);
    if (validated.deliverables.length === 0) delete validated.deliverables;
  }

  if (validated.constraints) {
    validated.constraints = validated.constraints.map((c) => c.trim()).filter(Boolean);
  }

  if (validated.risks) {
    validated.risks = validated.risks.map((r) => r.trim()).filter(Boolean);
  }

  return validated;
}

/** True when two facts objects agree on core factual fields. */
export function campaignFactsMatchCore(
  a: CampaignFacts,
  b: CampaignFacts
): { match: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  if (a.brandName !== b.brandName) mismatches.push(`brandName: ${a.brandName} vs ${b.brandName}`);
  if (a.budget?.amount !== b.budget?.amount) {
    mismatches.push(`budget.amount: ${a.budget?.amount} vs ${b.budget?.amount}`);
  }
  if (a.budget?.currency !== b.budget?.currency) {
    mismatches.push(`budget.currency: ${a.budget?.currency} vs ${b.budget?.currency}`);
  }
  if (a.durationWeeks !== b.durationWeeks) {
    mismatches.push(`durationWeeks: ${a.durationWeeks} vs ${b.durationWeeks}`);
  }

  return { match: mismatches.length === 0, mismatches };
}
