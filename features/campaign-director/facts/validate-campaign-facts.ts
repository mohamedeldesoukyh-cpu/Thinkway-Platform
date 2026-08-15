import { clampCampaignDurationWeeks } from "@/features/campaign-studio/services/timeline-duration";
import {
  countryLabel,
  isValidBrandName,
  isValidClientName,
  recoverLabeledEntityFromText,
  resolveCountryCode,
  sanitizeBrandName,
} from "@/features/campaign-intelligence-profile/services/normalization/validators";

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
  }

  if (validated.brandName) {
    const cleaned = sanitizeBrandName(validated.brandName);
    if (!isValidBrandName(cleaned)) {
      delete validated.brandName;
      delete validated.confidence.brandName;
      delete validated.sources.brandName;
    } else {
      validated.brandName = cleaned;
    }
  }

  if (!validated.brandName && validated.rawBriefExcerpt) {
    const recovered = recoverLabeledEntityFromText(validated.rawBriefExcerpt, "brand");
    if (recovered) {
      validated.brandName = recovered;
      validated.confidence.brandName = 0.9;
      validated.sources.brandName = "brief";
    }
  }

  if (validated.clientName) {
    const cleaned = sanitizeBrandName(validated.clientName);
    if (!isValidClientName(cleaned)) {
      delete validated.clientName;
      delete validated.confidence.clientName;
      delete validated.sources.clientName;
    } else {
      validated.clientName = cleaned;
    }
  }

  if (!validated.clientName && validated.rawBriefExcerpt) {
    const recovered = recoverLabeledEntityFromText(validated.rawBriefExcerpt, "client");
    if (recovered) {
      validated.clientName = recovered;
      validated.confidence.clientName = 0.9;
      validated.sources.clientName = "brief";
    }
  }

  if (validated.objective) {
    // Single-line briefs often append "Need N creators…" after the objective clause.
    const truncated = validated.objective
      .split(/(?<=\.)\s+(?=Need\b|Please\b)/i)[0]
      ?.trim()
      .replace(/[.,;:\s]+$/g, "");
    if (truncated) validated.objective = truncated;
  }

  if (validated.geography) {
    const cleanedGeo = validated.geography
      .map((g) => {
        const code = resolveCountryCode(g);
        return code ? countryLabel(code) : null;
      })
      .filter((g): g is string => Boolean(g));
    validated.geography = [...new Set(cleanedGeo)].slice(0, 5);
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
