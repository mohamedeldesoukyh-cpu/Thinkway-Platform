/**
 * One creator-tier source of truth.
 *
 * The Strategy screen previously showed a hardcoded summary ("Micro + Mid ·
 * category creators") next to a tier allocation from an unrelated percentage
 * table ("3 Macro (40%) + 2 Micro (35%) + 2 Nano (25%)"). Both representations
 * must now read the same resolved mix.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import { creatorTierStrategyToMix } from "@/features/campaign-director/facts/facts-display-bridge";

import {
  deriveCreatorQuantityRecommendation,
  formatCreatorTierMixSummary,
  resolveCreatorTierMix,
} from "./creator-quantity";
import { deriveInfluencerStrategyView } from "./influencer-strategy-view";
import { getIndustryCreatorMix } from "./creator-tier-mix-by-industry";

const NOW = "2026-01-01T00:00:00.000Z";

const facts: CampaignFacts = {
  brandName: "Tafareeh Tea",
  industry: "Brand Campaign",
  objective: "build awareness and encourage people to try the product",
  budget: { amount: 3_000_000, currency: "EGP" },
  durationWeeks: 2,
  platforms: ["Instagram", "TikTok"],
  geography: ["Egypt"],
  audience: "Egyptian tea drinkers",
  creatorCategories: ["Food"],
  extractedAt: NOW,
  confidence: {},
  sources: {},
};

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 1,
  createdAt: NOW,
  understanding: {
    brand: "Tafareeh Tea",
    objective: "Awareness",
    audience: "Egyptian tea drinkers",
    platforms: ["Instagram"],
    kpis: [],
    risks: [],
    constraints: [],
  },
  narrative: "",
  pillars: [],
  platformMix: [],
  creatorTierStrategy: [
    { tier: "Micro", allocationPercent: 60, why: "Community depth" },
    { tier: "Mid", allocationPercent: 40, why: "Reach balance" },
  ],
};

function campaignObject(meta: Record<string, unknown> = {}): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      summary: { status: "complete", content: "Tafareeh Tea" },
      audience: { status: "complete", content: "" },
      strategy: { status: "complete", content: "Tea campaign" },
      creators: { status: "complete", content: "", data: {} },
      budget: { status: "complete", content: "", data: {} },
      timeline: { status: "complete", content: "", data: {} },
      performance: { status: "complete", content: "", data: {} },
      presentation: { status: "complete", content: "", data: {} },
      operations: { status: "complete", content: "", data: {} },
    },
    meta: { status: "complete", specialistProgress: [], campaignFacts: facts, ...meta },
  } as unknown as CampaignObject;
}

function rowBody(object: CampaignObject, key: string): string {
  return deriveInfluencerStrategyView(object).find((row) => row.key === key)?.body ?? "";
}

test("O: an explicit Strategy tier allocation is the source of truth", () => {
  const mix = resolveCreatorTierMix(facts, creatorTierStrategyToMix(strategy.creatorTierStrategy));
  assert.deepEqual(
    mix.map((tier) => `${tier.tier} ${tier.percent}%`),
    ["Micro 60%", "Mid 40%"]
  );
});

test("O: with no Strategy allocation, one documented fallback is used", () => {
  const mix = resolveCreatorTierMix(facts);

  // The fallback is now the industry recommendation for this campaign's
  // industry, taken from the one industry mix table. It is deliberately NOT a
  // universal percentage: `Macro 40 / Micro 35 / Nano 25` used to be returned
  // for every industry without a branch, which is what made unrelated
  // campaigns identical.
  assert.deepEqual(
    mix.map((tier) => `${tier.tier} ${tier.percent}%`),
    getIndustryCreatorMix("general")
      .filter((tier) => tier.percent > 0 || tier.count > 0)
      .map((tier) => `${tier.tier} ${tier.percent}%`)
  );
  assert.notEqual(
    mix.map((tier) => `${tier.tier} ${tier.percent}%`).join(" / "),
    "Macro 40% / Micro 35% / Nano 25%"
  );
  assert.equal(mix.reduce((sum, tier) => sum + tier.percent, 0), 100);
});

test("O: the summary line and the tier allocation agree — fallback case", () => {
  const object = campaignObject();
  const summary = rowBody(object, "influencerStrategy");
  const tiers = rowBody(object, "creatorTiers");

  assert.notEqual(summary, "", "summary should render");
  assert.notEqual(tiers, "", "tier allocation should render");

  // Both representations must name exactly the resolved mix's tiers — asserted
  // against the resolved value rather than a fixed list, so the check survives
  // a change to the industry recommendation.
  const resolved = resolveCreatorTierMix(facts).map((tier) => tier.tier);
  const allTiers = ["Celebrity", "Mega", "Macro", "Mid", "Micro", "Nano"] as const;
  for (const tier of allTiers) {
    const expected = resolved.includes(tier);
    assert.equal(summary.includes(tier), expected, `summary / ${tier}`);
    assert.equal(tiers.includes(tier), expected, `allocation / ${tier}`);
  }
});

test("O: the summary line and the tier allocation agree — Strategy case", () => {
  const object = campaignObject({ campaignStrategyDocument: strategy });
  const summary = rowBody(object, "influencerStrategy");
  const tiers = rowBody(object, "creatorTiers");

  for (const tier of ["Micro", "Mid"]) {
    assert.ok(summary.includes(tier), `summary names ${tier}`);
    assert.ok(tiers.includes(tier), `allocation names ${tier}`);
  }
  assert.equal(summary.includes("Macro"), false, "no stale Macro from the fallback table");
  assert.equal(tiers.includes("Nano"), false);
});

test("the Strategy view reads canonical categories, not the raw brief", () => {
  const object = campaignObject();
  assert.match(rowBody(object, "creatorCategories"), /Food/);
});

test("quantity recommendation honours an injected Strategy mix", () => {
  const withStrategy = deriveCreatorQuantityRecommendation(facts, {
    tierMix: creatorTierStrategyToMix(strategy.creatorTierStrategy),
  });
  assert.deepEqual(
    withStrategy.mix.map((tier) => tier.tier),
    ["Micro", "Mid"]
  );
  const fallback = deriveCreatorQuantityRecommendation(facts);
  assert.deepEqual(
    fallback.mix.map((tier) => tier.tier),
    getIndustryCreatorMix("general")
      .filter((tier) => tier.percent > 0 || tier.count > 0)
      .map((tier) => tier.tier),
    "with no Strategy allocation the industry recommendation applies"
  );
  assert.equal(withStrategy.recommended, fallback.recommended, "headcount logic unchanged");
});

test("formatCreatorTierMixSummary is empty for an empty mix", () => {
  assert.equal(formatCreatorTierMixSummary([]), undefined);
});
