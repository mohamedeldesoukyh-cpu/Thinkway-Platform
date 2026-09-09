/**
 * Phase 2 business rule — budget is never a Discovery requirement.
 *
 * A client may brief without a budget. That campaign must still complete Intake
 * and run Strategy → CSR → Discovery → recommendations → Shortlist. Budget is
 * a commercial fact, resolved later; it must never reach a SQL filter, never
 * become a CSR blocking gap, and never change what Discovery retrieves.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import { requiredIntakeFacts } from "../studio-intake-facts";

import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";
import { mergeCsrFiltersIntoDiscoveryFilters } from "./merge-csr-into-discovery-filters";

const NOW = "2026-01-01T00:00:00.000Z";

/** A distinctive amount: if it leaks into a filter, it is unmistakable. */
const BUDGET = { amount: 3_000_000, currency: "EGP" } as const;

const validated: ValidatedCampaignIntelligence = {
  brand: { brandName: "Tafareeh Tea" },
  market: { countryCode: "EG", countryLabel: "Egypt", cities: [] },
  audience: { countries: ["EG"], cities: [], gender: "any", languages: ["ar"] },
  creator: { niches: [], creatorTypes: [] },
  platforms: ["instagram", "tiktok"],
  categories: ["Food"],
  keywords: ["tea"],
  brandSafety: "none",
  fieldEvidence: {},
  validatedAt: NOW,
};

function strategyWith(budget?: { amount: number; currency: string }): CampaignStrategyDocument {
  return {
    id: "strategy-1",
    version: 1,
    createdAt: NOW,
    understanding: {
      brand: "Tafareeh Tea",
      objective: "Build awareness and encourage trial",
      geography: "Egypt",
      audience: "Egyptian tea drinkers",
      platforms: ["Instagram", "TikTok"],
      kpis: [],
      risks: [],
      constraints: [],
      ...(budget ? { budget } : {}),
    },
    narrative: "Everyday tea moments.",
    pillars: [{ title: "Food", what: "Tea rituals", why: "Daily habit" }],
    platformMix: [{ platform: "Instagram", role: "Reels", why: "Reach" }],
    creatorTierStrategy: [{ tier: "Micro", allocationPercent: 100, why: "Engagement" }],
  } as CampaignStrategyDocument;
}

function factsWith(budget?: { amount: number; currency: string }): CampaignFacts {
  return {
    brandName: "Tafareeh Tea",
    clientName: "Tafareeh Tea",
    product: "Tafareeh Ramadan Push",
    objective: "Build awareness and encourage trial",
    audience: "Egyptian tea drinkers, mainly young adults and families",
    geography: ["Egypt"],
    platforms: ["instagram", "tiktok"],
    creatorCategories: ["Food"],
    deliverables: ["1 Instagram Reel", "1 Instagram Story"],
    durationWeeks: 2,
    kpis: [],
    industry: "Brand Campaign",
    sources: {},
    confidence: {},
    ...(budget ? { budget } : {}),
  } as unknown as CampaignFacts;
}

test("a CSR with a budget and one without produce identical Discovery filters", () => {
  const withBudget = buildCreatorSearchRequirements({
    strategy: strategyWith(BUDGET),
    validated,
    facts: factsWith(BUDGET),
    now: NOW,
  });
  const withoutBudget = buildCreatorSearchRequirements({
    strategy: strategyWith(),
    validated,
    facts: factsWith(),
    now: NOW,
  });

  // Guard: the budgeted CSR really does carry the budget in its strategic layer.
  assert.deepEqual(withBudget.strategic.budget, { ...BUDGET });
  assert.equal(withoutBudget.strategic.budget, undefined);

  const a = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements: withBudget }).filters;
  const b = mergeCsrFiltersIntoDiscoveryFilters({
    current: [],
    requirements: withoutBudget,
  }).filters;

  const shape = (filters: typeof a) =>
    filters.map((f) => `${f.key}:${f.value}`).sort();
  assert.deepEqual(shape(a), shape(b), "budget must not change what Discovery retrieves");
});

test("a campaign with no budget still produces a usable CSR", () => {
  const requirements = buildCreatorSearchRequirements({
    strategy: strategyWith(),
    validated,
    facts: factsWith(),
    now: NOW,
  });

  assert.ok(
    !requirements.gaps.some((gap) => /budget/i.test(gap.field) || /budget/i.test(gap.reason)),
    "budget must never be recorded as a CSR gap"
  );
  assert.ok(!requirements.gaps.some((gap) => gap.blocking), "no blocking gap without a budget");
  assert.ok(requirements.search.platforms.length > 0);
  assert.ok(requirements.search.primaryCategories.length > 0);
  assert.ok(
    requirements.search.creatorCountries.length > 0 ||
      requirements.search.audienceCountries.length > 0
  );
});

test("a campaign with no budget still contributes CSR filters to Discovery", () => {
  const requirements = buildCreatorSearchRequirements({
    strategy: strategyWith(),
    validated,
    facts: factsWith(),
    now: NOW,
  });

  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements });
  assert.ok(merged.filters.length > 0, "a budget-less campaign must still reach live Discovery");
  assert.ok(merged.added.length > 0);
});

test("no monetary value appears in any Discovery filter key, label or value", () => {
  const requirements = buildCreatorSearchRequirements({
    strategy: strategyWith(BUDGET),
    validated,
    facts: factsWith(BUDGET),
    now: NOW,
  });

  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements }).filters;
  const haystack = merged
    .map((f) => `${f.key} ${f.label} ${f.value}`)
    .join(" ")
    .toLowerCase();

  for (const marker of ["3000000", "3,000,000", "3 000 000", "egp", "budget"]) {
    assert.ok(!haystack.includes(marker), `"${marker}" leaked into a Discovery filter`);
  }
});

test("Intake can be confirmed without a budget", () => {
  const intake = requiredIntakeFacts(factsWith());

  assert.equal(intake.canConfirm, true, "a budget-less brief must be able to complete Intake");
  assert.ok(
    !intake.missing.some((row) => row.key === "budget"),
    "budget must not be a blocking Intake fact"
  );

  const budgetRow = intake.rows.find((row) => row.key === "budget");
  assert.ok(budgetRow, "the budget row must stay visible");
  assert.equal(budgetRow!.required, false);
  assert.equal(budgetRow!.state, "missing");
});

test("an operator-provided budget is preserved as a confirmed campaign reference", () => {
  const intake = requiredIntakeFacts(factsWith(BUDGET));
  const budgetRow = intake.rows.find((row) => row.key === "budget");

  assert.equal(budgetRow!.state, "confirmed");
  assert.equal(budgetRow!.value, "EGP 3,000,000");
  assert.equal(intake.canConfirm, true);
});

test("campaign name stays required and is never taken from the brief", () => {
  const withoutName = { ...factsWith(), product: undefined } as unknown as CampaignFacts;
  const intake = requiredIntakeFacts(withoutName);

  assert.equal(intake.canConfirm, false);
  assert.ok(intake.missing.some((row) => row.key === "campaign"));

  const campaignRow = intake.rows.find((row) => row.key === "campaign");
  assert.equal(campaignRow!.required, true, "campaign name remains manually entered");
});
