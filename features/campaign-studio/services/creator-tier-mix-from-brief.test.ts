/**
 * The creator tier mix, from brief text to the mix the slate consumes.
 *
 * Three campaigns, as required: an explicit tier preference with no
 * percentages, no preference at all, and an explicit percentage split.
 *
 * The bug this pins: `Macro 40 / Micro 35 / Nano 25` was a hardcoded universal
 * fallback, produced for every industry without a branch, and a brief that
 * asked for Macro / Mid / Micro was ignored because nothing captured it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import { validateCampaignFacts } from "@/features/campaign-director/facts/validate-campaign-facts";
import {
  buildCreatorMixFromFacts,
  creatorTierStrategyToMix,
} from "@/features/campaign-director/facts/facts-display-bridge";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";

import {
  creatorTierPreferenceFromFacts,
  resolveCreatorTierMixFromPreference,
} from "@/features/campaign-director/facts/creator-tier-preference";
import { getIndustryCreatorMix } from "./creator-tier-mix-by-industry";

import {
  deriveCreatorQuantityRecommendation,
  formatCreatorTierMixSummary,
  resolveCreatorTierMix,
  resolveCreatorTierMixWithBasis,
} from "./creator-quantity";

function factsFrom(brief: string): CampaignFacts {
  return validateCampaignFacts(extractCampaignFacts({ rawMessage: brief }));
}

function shape(mix: Array<{ tier: string; percent: number }>): string {
  return mix.map((tier) => `${tier.tier} ${tier.percent}%`).join(" / ");
}

const GENERIC_FALLBACK = "Macro 40% / Micro 35% / Nano 25%";

// ---------------------------------------------------------------------------
// 1. Kérastase — the brief names tiers, with no percentages.

const KERASTASE_BRIEF = [
  "Kérastase Egypt — Influencer Campaign Brief",
  "Brand: Kérastase",
  "Market: Egypt",
  "Campaign Duration: 4 Weeks",
  "Total Influencer Budget: EGP 3,000,000",
  "Primary Objective: Drive Consideration & Conversion for premium haircare.",
  "Target Audience: Women aged 20–40 in Egypt interested in premium beauty and haircare.",
  "4. Influencer Profile",
  "Preferred Creator Mix: Macro / Mid / Micro",
  "Strong credibility in beauty, haircare, lifestyle and fashion.",
].join("\n");

test("Kérastase: the brief's Macro / Mid / Micro is captured as a stated fact", () => {
  const facts = factsFrom(KERASTASE_BRIEF);

  assert.deepEqual(facts.creatorTiers, [
    { tier: "Macro" },
    { tier: "Mid" },
    { tier: "Micro" },
  ]);
  assert.equal(facts.sources.creatorTiers, "brief", "the tiers came from the brief itself");
  assert.ok(
    facts.creatorTiers!.every((tier) => tier.percent == null),
    "the brief gave no percentages, so none are attributed to it"
  );
});

test("Kérastase: the mix is exactly those tiers, and no longer 40/35/25", () => {
  const facts = factsFrom(KERASTASE_BRIEF);
  const { mix, basis } = resolveCreatorTierMixWithBasis(facts);

  assert.deepEqual(
    mix.map((tier) => tier.tier),
    ["Macro", "Mid", "Micro"],
    "Nano is not in the brief, so it is not in the mix"
  );
  assert.notEqual(shape(mix), GENERIC_FALLBACK);
  assert.equal(mix.reduce((sum, tier) => sum + tier.percent, 0), 100);
  assert.equal(basis, "brief_tiers_recommended_split");
  assert.ok(
    mix.every((tier) => /recommended allocation/i.test(tier.reasoning)),
    "the split is presented as a recommendation, not as the brief's own figures"
  );
});

test("Kérastase: a pre-brief Strategy allocation is reconciled to the brief's tiers", () => {
  // A Strategy generated before the brief tiers were captured — the 40/35/25
  // document itself. It must not override what the brief asked for.
  const facts = factsFrom(KERASTASE_BRIEF);
  const storedStrategyMix = creatorTierStrategyToMix([
    { tier: "Macro", allocationPercent: 40, why: "Macro creators balance reach and production quality" },
    { tier: "Micro", allocationPercent: 35, why: "Micro tier drives engagement in category communities" },
    { tier: "Nano", allocationPercent: 25, why: "Nano tier provides cost-efficient long-tail coverage" },
  ]);

  const { mix, basis } = resolveCreatorTierMixWithBasis(facts, storedStrategyMix);

  assert.deepEqual(mix.map((tier) => tier.tier), ["Macro", "Mid", "Micro"]);
  assert.equal(basis, "brief_tiers_recommended_split");
  assert.equal(mix.reduce((sum, tier) => sum + tier.percent, 0), 100);
});

test("Kérastase: the Strategy mix and the slate mix are the same value", () => {
  const facts = factsFrom(KERASTASE_BRIEF);
  const strategyMix = resolveCreatorTierMix(facts);
  const slateMix = deriveCreatorQuantityRecommendation(facts).mix;

  assert.deepEqual(
    slateMix.map((tier) => [tier.tier, tier.percent]),
    strategyMix.map((tier) => [tier.tier, tier.percent]),
    "the slate consumes the approved Strategy mix, not a parallel default"
  );
  assert.ok(formatCreatorTierMixSummary(slateMix)?.startsWith("Micro + Mid + Macro"));
});

// ---------------------------------------------------------------------------
// 2. A campaign with no creator-tier preference.

const NO_PREFERENCE_BRIEF = [
  "Tafareeh Tea — Influencer Campaign Brief",
  "Brand: Tafareeh Tea",
  "Market: Saudi Arabia",
  "Campaign Duration: 6 Weeks",
  "Total Budget: SAR 900,000",
  "Objective: Build brand awareness for the new iced tea range.",
  "Audience: Adults 18–35 in Saudi Arabia who drink ready-to-drink beverages.",
  "Deliverables: 1 TikTok video and 3 Instagram Stories per creator.",
].join("\n");

test("no stated preference: nothing is invented on the brief's behalf", () => {
  const facts = factsFrom(NO_PREFERENCE_BRIEF);

  assert.equal(facts.creatorTiers, undefined);
  assert.equal(facts.sources.creatorTiers, undefined);
});

test("no stated preference: the industry recommendation applies, labelled as one", () => {
  const facts = factsFrom(NO_PREFERENCE_BRIEF);
  const { mix, basis } = resolveCreatorTierMixWithBasis(facts);

  assert.equal(basis, "recommended");
  assert.ok(mix.length > 0, "a campaign-specific recommendation is still produced");
  assert.equal(mix.reduce((sum, tier) => sum + tier.percent, 0), 100);
});

test("unrelated campaigns no longer collapse onto one universal percentage", () => {
  const industries = [
    "Beauty & Personal Care",
    "Luxury",
    "Tourism",
    "Finance & Banking",
    "Brand Campaign",
    "Retail & Sportswear",
    "Baby & Parenting",
    "Telecom",
  ];

  const shapes = industries.map((industry) =>
    shape(
      buildCreatorMixFromFacts({
        industry,
        extractedAt: new Date().toISOString(),
        confidence: {},
        sources: {},
      })
    )
  );

  for (const [index, value] of shapes.entries()) {
    assert.notEqual(
      value,
      GENERIC_FALLBACK,
      `${industries[index]} still returns the universal fallback`
    );
  }
  // Five of these industries previously produced the identical 40/35/25.
  assert.ok(
    new Set(shapes).size >= 6,
    `industries must differ from each other, got ${new Set(shapes).size} distinct: ${shapes.join(" | ")}`
  );
});

// ---------------------------------------------------------------------------
// 3. A campaign with an explicit percentage mix.

const EXPLICIT_PERCENT_BRIEF = [
  "Noon Ramadan Campaign — Influencer Brief",
  "Brand: Noon",
  "Market: UAE",
  "Campaign Duration: 3 Weeks",
  "Total Budget: AED 500,000",
  "Objective: Drive app installs and first orders.",
  "Creator Tier Mix: Macro 50%, Micro 30%, Nano 20%",
].join("\n");

test("an explicit percentage mix is used exactly as stated", () => {
  const facts = factsFrom(EXPLICIT_PERCENT_BRIEF);

  assert.deepEqual(facts.creatorTiers, [
    { tier: "Macro", percent: 50 },
    { tier: "Micro", percent: 30 },
    { tier: "Nano", percent: 20 },
  ]);

  const { mix, basis } = resolveCreatorTierMixWithBasis(facts);
  assert.equal(basis, "brief_percentages");
  assert.equal(shape(mix), "Macro 50% / Micro 30% / Nano 20%");
});

test("an explicit percentage mix is not overridden by a Strategy allocation", () => {
  const facts = factsFrom(EXPLICIT_PERCENT_BRIEF);
  const storedStrategyMix = creatorTierStrategyToMix([
    { tier: "Mid", allocationPercent: 60, why: "generated default" },
    { tier: "Micro", allocationPercent: 40, why: "generated default" },
  ]);

  const { mix } = resolveCreatorTierMixWithBasis(facts, storedStrategyMix);
  assert.equal(shape(mix), "Macro 50% / Micro 30% / Nano 20%");
});

test("the stated split survives into the slate's counted mix", () => {
  const facts = factsFrom(EXPLICIT_PERCENT_BRIEF);
  const quantity = deriveCreatorQuantityRecommendation(facts);

  assert.deepEqual(
    quantity.mix.map((tier) => [tier.tier, tier.percent]),
    [
      ["Macro", 50],
      ["Micro", 30],
      ["Nano", 20],
    ]
  );
  assert.ok(
    quantity.mix.every((tier) => tier.count >= 0),
    "counts are allocated from the stated percentages"
  );
});

// ---------------------------------------------------------------------------
// Tier integrity through Discovery (Part 7).
//
// Strategy correctly dropped Nano for a Macro/Mid/Micro brief, but the
// Discovery search composed its slate straight from the industry mix — which
// for beauty includes Nano — so the tier the brief excluded came back at the
// acquisition step.

test("Discovery's slate mix honours the brief's tiers, not the raw industry mix", () => {
  const facts = factsFrom(KERASTASE_BRIEF);
  const industryMix = getIndustryCreatorMix("beauty").filter((tier) => tier.percent > 0);

  assert.ok(
    industryMix.some((tier) => tier.tier === "Nano"),
    "precondition: the beauty industry mix contains Nano"
  );

  // The same resolution the Discovery search now applies to its base mix.
  const { mix } = resolveCreatorTierMixFromPreference({
    preference: creatorTierPreferenceFromFacts(facts),
    baseMix: getIndustryCreatorMix("beauty"),
  });

  assert.deepEqual(mix.map((tier) => tier.tier), ["Macro", "Mid", "Micro"]);
  assert.ok(
    !mix.some((tier) => tier.tier === "Nano" || tier.tier === "Mega" || tier.tier === "Celebrity"),
    "no tier outside the brief is recommended automatically"
  );
});

test("with no stated tiers Discovery keeps the industry mix exactly", () => {
  const facts = factsFrom(NO_PREFERENCE_BRIEF);
  const baseMix = getIndustryCreatorMix("general");

  const { mix, basis } = resolveCreatorTierMixFromPreference({
    preference: creatorTierPreferenceFromFacts(facts),
    baseMix,
  });

  assert.equal(basis, "recommended");
  assert.deepEqual(mix, baseMix, "unchanged when the brief states nothing");
});

test("the same approved tier set reaches Strategy, the slate and Discovery", () => {
  const facts = factsFrom(KERASTASE_BRIEF);

  const strategyTiers = resolveCreatorTierMix(facts).map((tier) => tier.tier);
  const slateTiers = deriveCreatorQuantityRecommendation(facts).mix.map((tier) => tier.tier);
  const discoveryTiers = resolveCreatorTierMixFromPreference({
    preference: creatorTierPreferenceFromFacts(facts),
    baseMix: getIndustryCreatorMix("beauty"),
  }).mix.map((tier) => tier.tier);

  assert.deepEqual(new Set(slateTiers), new Set(strategyTiers));
  assert.deepEqual(new Set(discoveryTiers), new Set(strategyTiers));
});
