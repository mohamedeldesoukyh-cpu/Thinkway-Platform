/**
 * One resolved tier mix, from Strategy through CSR to the slate.
 *
 * Two derivations bypassed the canonical resolution and read the stored
 * `strategy.creatorTierStrategy` verbatim: the Creator Search Requirements
 * strategic layer (which Discovery consumes) and the executive strategy
 * narrative (the Director conclusion the operator reads). A Strategy document
 * generated before the brief's tiers were captured — or a debate winner
 * carrying a tier the brief excluded — therefore reached Discovery and the
 * narrative with that tier, while the Creator Tiers card beside it showed the
 * reconciled mix.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { buildExecutiveStrategyReasoning } from "@/features/campaign-intelligence/services/reasoning/executive-strategy-reasoning";

import { buildCreatorSearchRequirements } from "./creator-search-requirements/build-creator-search-requirements";
import { deriveCreatorQuantityRecommendation, resolveCreatorTierMix } from "./creator-quantity";

const NOW = "2026-04-01T00:00:00.000Z";

/** Kérastase: the brief names Macro / Mid / Micro and gives no percentages. */
const FACTS: CampaignFacts = {
  clientName: "Kérastase",
  brandName: "Kérastase",
  industry: "Beauty & Personal Care",
  objective: "Drive Consideration & Conversion",
  audience: "Women aged 20–40 in Egypt interested in premium beauty and haircare",
  geography: ["Egypt"],
  platforms: ["instagram", "tiktok"],
  creatorCategories: ["Beauty", "Fashion"],
  creatorTiers: [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }],
  budget: { amount: 3_000_000, currency: "EGP" },
  durationWeeks: 4,
  rawBriefExcerpt: "Kérastase Egypt premium haircare brief. Preferred creator mix: Macro / Mid / Micro",
  extractedAt: NOW,
  confidence: {},
  sources: { creatorTiers: "brief", objective: "brief" },
};

/** A stored Strategy from before the brief tiers existed — it carries Nano. */
const STALE_STRATEGY: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 1,
  createdAt: NOW,
  understanding: {
    brand: "Kérastase",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    platforms: ["instagram", "tiktok"],
    kpis: [],
    risks: [],
    constraints: [],
  },
  narrative: "",
  pillars: [],
  platformMix: [],
  creatorTierStrategy: [
    { tier: "Macro", allocationPercent: 40, why: "Macro creators balance reach and production quality" },
    { tier: "Micro", allocationPercent: 35, why: "Micro tier drives engagement in category communities" },
    { tier: "Nano", allocationPercent: 25, why: "Nano tier provides cost-efficient long-tail coverage" },
  ],
} as unknown as CampaignStrategyDocument;

function tiersOf(mix: Array<{ tier: string }>): string[] {
  return mix.map((entry) => entry.tier);
}

test("CSR carries the reconciled tiers, not the stored allocation", () => {
  const csr = buildCreatorSearchRequirements({
    facts: FACTS,
    strategy: STALE_STRATEGY,
    now: NOW,
  });

  assert.deepEqual(tiersOf(csr.strategic.tierMix), ["Macro", "Mid", "Micro"]);
  assert.ok(
    !csr.strategic.tierMix.some((entry) => entry.tier === "Nano"),
    "a tier the brief excluded must not reach Discovery through CSR"
  );
  assert.equal(
    csr.strategic.tierMix.reduce((sum, entry) => sum + entry.percent, 0),
    100
  );
});

test("the Director conclusion states the reconciled mix", () => {
  const reasoning = buildExecutiveStrategyReasoning(FACTS, STALE_STRATEGY);

  assert.match(reasoning.directorConclusion, /Macro/);
  assert.match(reasoning.directorConclusion, /Mid/);
  assert.match(reasoning.directorConclusion, /Micro/);
  assert.ok(
    !/Nano/.test(reasoning.directorConclusion),
    `the narrative still names Nano: ${reasoning.directorConclusion}`
  );
  assert.ok(!/Nano/.test(reasoning.strategicInsight));
  assert.ok(!/Nano/.test(reasoning.chosenStrategy));
});

test("Strategy, CSR and the slate agree on the tier set", () => {
  const strategyTiers = tiersOf(resolveCreatorTierMix(FACTS));
  const slateTiers = tiersOf(deriveCreatorQuantityRecommendation(FACTS).mix);
  const csrTiers = tiersOf(
    buildCreatorSearchRequirements({ facts: FACTS, strategy: STALE_STRATEGY, now: NOW })
      .strategic.tierMix
  );

  assert.deepEqual(new Set(slateTiers), new Set(strategyTiers));
  assert.deepEqual(new Set(csrTiers), new Set(strategyTiers));
});

test("with no stated preference the stored allocation is used unchanged", () => {
  const noPreference: CampaignFacts = { ...FACTS, creatorTiers: undefined, sources: {} };

  const csr = buildCreatorSearchRequirements({
    facts: noPreference,
    strategy: STALE_STRATEGY,
    now: NOW,
  });
  assert.deepEqual(tiersOf(csr.strategic.tierMix), ["Macro", "Micro", "Nano"]);
  assert.deepEqual(
    csr.strategic.tierMix.map((entry) => entry.percent),
    [40, 35, 25],
    "the approved Strategy allocation is authoritative when the brief said nothing"
  );

  const reasoning = buildExecutiveStrategyReasoning(noPreference, STALE_STRATEGY);
  assert.match(reasoning.directorConclusion, /Nano 25%/);
});

test("the tier why-text survives into CSR", () => {
  const csr = buildCreatorSearchRequirements({
    facts: FACTS,
    strategy: STALE_STRATEGY,
    now: NOW,
  });
  assert.ok(
    csr.strategic.tierMix.every((entry) => entry.why.trim().length > 0),
    "each tier keeps a stated reason"
  );
  assert.ok(
    csr.strategic.tierMix.some((entry) => /recommended allocation/i.test(entry.why)),
    "a computed split says it is a recommendation"
  );
});
