/**
 * A generated debate option must not contradict the confirmed campaign brief.
 *
 * `maxReachTiers` and `maxEngagementTiers` return fixed ladders — they read the
 * base only to decide whether Mega is in play — so a Macro/Mid/Micro brief got
 * generated options carrying Nano and no Mid, and `applyWinnerOptionToStrategy`
 * persisted that as `strategy.creatorTierStrategy`: a stored Strategy whose
 * tier allocation contradicted the brief.
 *
 * The archetypes still differ materially; they are now expressed over the tiers
 * the campaign actually confirmed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "../types";

import { applyWinnerOptionToStrategy } from "./apply-winner";
import { generateCampaignOptions } from "./option-generator";
import type { CampaignOption, DebateResult } from "./debate-types";

const NOW = "2026-04-01T00:00:00.000Z";

/** The approved Strategy allocation for Kérastase — already brief-aware. */
const STRATEGY: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 1,
  createdAt: NOW,
  narrative: "",
  pillars: [],
  platformMix: [],
  understanding: {
    brand: "Kérastase",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt interested in premium haircare",
    platforms: ["instagram", "tiktok"],
    kpis: [{ metric: "Engagement Rate", target: "3%", why: "Stated in the brief" }],
    risks: [],
    constraints: [],
  },
  creatorTierStrategy: [
    { tier: "Macro", allocationPercent: 24, why: "Category authority and campaign scale" },
    { tier: "Mid", allocationPercent: 35, why: "Routine and demonstration content depth" },
    { tier: "Micro", allocationPercent: 41, why: "Trusted haircare communities" },
  ],
} as unknown as CampaignStrategyDocument;

function facts(overrides: Partial<CampaignFacts> = {}): CampaignFacts {
  return {
    brandName: "Kérastase",
    clientName: "Kérastase",
    industry: "Beauty & Personal Care",
    objective: "Drive Consideration & Conversion",
    audience: "Women aged 20–40 in Egypt",
    geography: ["Egypt"],
    platforms: ["instagram", "tiktok"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 4,
    extractedAt: NOW,
    confidence: {},
    sources: {},
    ...overrides,
  };
}

/** The brief states the tiers and no percentages. */
const BRIEF_TIERS = facts({
  creatorTiers: [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }],
  sources: { creatorTiers: "brief" },
});

function tiersOf(option: CampaignOption): string[] {
  return option.creatorTierStrategy.map((tier) => tier.tier);
}

function optionById(options: CampaignOption[], id: string): CampaignOption {
  const found = options.find((option) => option.id === id);
  assert.ok(found, `option ${id} missing`);
  return found;
}

// ---------------------------------------------------------------------------
// 1. Kérastase — the brief's tier set is respected by every generated option.

test("every generated option contains only the brief's tiers", () => {
  const options = generateCampaignOptions(BRIEF_TIERS, STRATEGY);

  for (const option of options) {
    assert.deepEqual(
      new Set(tiersOf(option)),
      new Set(["Macro", "Mid", "Micro"]),
      `${option.id} ${option.label}: ${tiersOf(option).join(", ")}`
    );
    for (const excluded of ["Nano", "Mega", "Celebrity"]) {
      assert.ok(
        !tiersOf(option).includes(excluded),
        `${option.label} introduced ${excluded}, which the brief excludes`
      );
    }
    assert.equal(
      option.creatorTierStrategy.reduce((sum, tier) => sum + tier.allocationPercent, 0),
      100,
      `${option.label} allocation must total 100`
    );
  }
});

test("the reach option is still reach-biased, over the confirmed tiers", () => {
  const reach = optionById(generateCampaignOptions(BRIEF_TIERS, STRATEGY), "A");
  const byTier = new Map(reach.creatorTierStrategy.map((t) => [t.tier, t.allocationPercent]));

  assert.equal(reach.archetype, "max_reach");
  assert.ok(
    (byTier.get("Macro") ?? 0) > (byTier.get("Micro") ?? 0),
    `reach option must lead with Macro: ${JSON.stringify([...byTier])}`
  );
});

test("the engagement option is still engagement-biased, over the confirmed tiers", () => {
  const engagement = optionById(generateCampaignOptions(BRIEF_TIERS, STRATEGY), "C");
  const byTier = new Map(engagement.creatorTierStrategy.map((t) => [t.tier, t.allocationPercent]));

  assert.equal(engagement.archetype, "max_engagement");
  assert.ok(
    (byTier.get("Micro") ?? 0) > (byTier.get("Macro") ?? 0),
    `engagement option must lead with Micro: ${JSON.stringify([...byTier])}`
  );
});

test("the options remain materially different from each other", () => {
  const options = generateCampaignOptions(BRIEF_TIERS, STRATEGY);
  const shapes = options.map((option) =>
    option.creatorTierStrategy.map((tier) => `${tier.tier}${tier.allocationPercent}`).join("|")
  );
  assert.equal(new Set(shapes).size, 3, `the debate must still offer real choices: ${shapes}`);
});

test("apply-winner cannot persist Nano from a generated option", () => {
  const options = generateCampaignOptions(BRIEF_TIERS, STRATEGY);

  for (const option of options) {
    const debateResult = {
      options,
      meeting: {
        winnerId: option.id,
        directorConclusion: `Option ${option.id} approved`,
      },
    } as unknown as DebateResult;

    const applied = applyWinnerOptionToStrategy(STRATEGY, debateResult);
    const tiers = applied.creatorTierStrategy.map((tier) => tier.tier);

    assert.ok(
      !tiers.includes("Nano"),
      `winning option ${option.id} persisted Nano: ${tiers.join(", ")}`
    );
    assert.deepEqual(new Set(tiers), new Set(["Macro", "Mid", "Micro"]));
  }
});

// ---------------------------------------------------------------------------
// 2. Explicit brief percentages stay exactly as stated.

test("a brief that states percentages keeps those tiers and those numbers", () => {
  const explicit = facts({
    creatorTiers: [
      { tier: "Macro", percent: 50 },
      { tier: "Micro", percent: 30 },
      { tier: "Nano", percent: 20 },
    ],
    sources: { creatorTiers: "brief" },
  });

  for (const option of generateCampaignOptions(explicit, STRATEGY)) {
    assert.deepEqual(
      option.creatorTierStrategy.map((tier) => [tier.tier, tier.allocationPercent]),
      [
        ["Macro", 50],
        ["Micro", 30],
        ["Nano", 20],
      ],
      `${option.label} must keep the brief's own split`
    );
  }
});

// ---------------------------------------------------------------------------
// 3. No stated preference — the existing archetype ladders are untouched.

test("with no tier preference the generated ladders are unchanged", () => {
  const options = generateCampaignOptions(facts(), STRATEGY);

  assert.deepEqual(
    optionById(options, "A").creatorTierStrategy.map((t) => [t.tier, t.allocationPercent]),
    [
      ["Macro", 70],
      ["Micro", 20],
      ["Nano", 10],
    ],
    "the documented max-reach ladder still applies when nothing is confirmed"
  );
  assert.deepEqual(
    optionById(options, "C").creatorTierStrategy.map((t) => [t.tier, t.allocationPercent]),
    [
      ["Macro", 15],
      ["Micro", 45],
      ["Nano", 40],
    ],
    "the documented max-engagement ladder is untouched"
  );
  assert.deepEqual(
    optionById(options, "B").creatorTierStrategy.map((t) => t.tier),
    ["Macro", "Mid", "Micro"],
    "balanced still clones the approved Strategy allocation"
  );
});

// ---------------------------------------------------------------------------
// 4. An operator decision is still a decision.

test("an operator-confirmed tier set including Nano is respected", () => {
  // The operator edited Intake to state the tiers themselves; provenance is
  // `operator`, which outranks the brief in the existing facts model.
  const operatorAddedNano = facts({
    creatorTiers: [{ tier: "Macro" }, { tier: "Micro" }, { tier: "Nano" }],
    sources: { creatorTiers: "operator" },
  });

  for (const option of generateCampaignOptions(operatorAddedNano, STRATEGY)) {
    assert.ok(
      tiersOf(option).includes("Nano"),
      `${option.label} dropped a tier the operator asked for: ${tiersOf(option).join(", ")}`
    );
    assert.ok(!tiersOf(option).includes("Mid"), "and does not re-add a tier they left out");
  }
});

test("the constraint applies to generated options only — a direct edit still writes through", () => {
  // `applyWinnerOptionToStrategy` writes the winner verbatim; an operator
  // revision path that hands it a tier set is persisted as given.
  const operatorOption = {
    ...optionById(generateCampaignOptions(BRIEF_TIERS, STRATEGY), "B"),
    creatorTierStrategy: [
      { tier: "Macro", allocationPercent: 40, why: "Operator decision" },
      { tier: "Nano", allocationPercent: 60, why: "Operator decision" },
    ],
  } as CampaignOption;

  const applied = applyWinnerOptionToStrategy(STRATEGY, {
    options: [operatorOption],
    meeting: { winnerId: operatorOption.id, directorConclusion: "Operator override" },
  } as unknown as DebateResult);

  assert.deepEqual(
    applied.creatorTierStrategy.map((tier) => tier.tier),
    ["Macro", "Nano"],
    "nothing blocks an explicit decision — the fix constrains generation, not persistence"
  );
});

// ---------------------------------------------------------------------------
// 5. Each option keeps a stated reason per tier.

test("every generated tier still carries a why", () => {
  for (const option of generateCampaignOptions(BRIEF_TIERS, STRATEGY)) {
    for (const tier of option.creatorTierStrategy) {
      assert.ok(tier.why.trim().length > 0, `${option.label}/${tier.tier} has no rationale`);
    }
  }
});
