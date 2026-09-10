/**
 * The brief's creator tier preference — read, not invented.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCreatorTierPreference,
  resolveCreatorTierMixFromPreference,
} from "./creator-tier-preference";
import type { CreatorMixTier } from "@/features/campaign-intelligence/types/section-schemas";

/** The existing beauty industry recommendation. */
const BEAUTY_MIX: CreatorMixTier[] = [
  { tier: "Macro", count: 1, percent: 20, reasoning: "Category authority and campaign scale" },
  { tier: "Mid", count: 3, percent: 30, reasoning: "Routine and demonstration content depth" },
  { tier: "Micro", count: 4, percent: 35, reasoning: "Trusted haircare communities" },
  { tier: "Nano", count: 3, percent: 15, reasoning: "Authentic before/after proof at volume" },
  { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required" },
];

// ---------------------------------------------------------------------------
// Parsing.

test("the Kérastase phrasing is read as Macro / Mid / Micro, with no percentages", () => {
  const preference = parseCreatorTierPreference(
    [
      "4. Influencer Profile",
      "We are looking for creators who have:",
      "Preferred Creator Mix: Macro / Mid / Micro",
      "Strong credibility in beauty and haircare.",
    ].join("\n")
  );

  assert.deepEqual(preference, [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }]);
});

test("stated percentages are captured against the tier they sit beside", () => {
  for (const line of [
    "Creator tier mix: Macro 50%, Micro 30%, Nano 20%",
    "Creator tier mix: Macro (50%) / Micro (30%) / Nano (20%)",
    "Creator tier mix: 50% Macro, 30% Micro, 20% Nano",
  ]) {
    assert.deepEqual(
      parseCreatorTierPreference(line),
      [
        { tier: "Macro", percent: 50 },
        { tier: "Micro", percent: 30 },
        { tier: "Nano", percent: 20 },
      ],
      line
    );
  }
});

test("a bulleted mix block under the label is read too", () => {
  const preference = parseCreatorTierPreference(
    ["7. Preferred Influencer Tiers", "- Macro — 40%", "- Mid — 40%", "- Micro — 20%", "", "8. Budget"].join(
      "\n"
    )
  );

  assert.deepEqual(preference, [
    { tier: "Macro", percent: 40 },
    { tier: "Mid", percent: 40 },
    { tier: "Micro", percent: 20 },
  ]);
});

test("an incidental tier mention is NOT a stated preference", () => {
  for (const text of [
    "Macro creators balance reach and production quality.",
    "We want micro creators who feel authentic.",
    "The campaign will lean on macro talent for launch week and micro voices later.",
    "Each creator should produce 1 Reel.",
  ]) {
    assert.deepEqual(parseCreatorTierPreference(text), [], text);
  }
});

test("no brief text, or a brief with no mix statement, yields no preference", () => {
  assert.deepEqual(parseCreatorTierPreference(undefined), []);
  assert.deepEqual(parseCreatorTierPreference(""), []);
  assert.deepEqual(
    parseCreatorTierPreference("Brand: Kérastase\nMarket: Egypt\nBudget: EGP 3,000,000"),
    []
  );
});

test("a single named tier alone is prose, unless a percentage makes it a split", () => {
  assert.deepEqual(parseCreatorTierPreference("Creator mix: mostly macro"), []);
  assert.deepEqual(parseCreatorTierPreference("Creator mix: Macro 100%"), [
    { tier: "Macro", percent: 100 },
  ]);
});

test("tier names are read in the brief's own order and never duplicated", () => {
  assert.deepEqual(
    parseCreatorTierPreference("Creator tiers: Micro, Macro, Micro, Mid-tier"),
    [{ tier: "Micro" }, { tier: "Macro" }, { tier: "Mid" }]
  );
});

// ---------------------------------------------------------------------------
// Resolution.

test("stated percentages are used exactly, and marked as the brief's", () => {
  const { mix, basis } = resolveCreatorTierMixFromPreference({
    preference: [
      { tier: "Macro", percent: 50 },
      { tier: "Micro", percent: 30 },
      { tier: "Nano", percent: 20 },
    ],
    baseMix: BEAUTY_MIX,
  });

  assert.equal(basis, "brief_percentages");
  assert.deepEqual(
    mix.map((tier) => [tier.tier, tier.percent]),
    [
      ["Macro", 50],
      ["Micro", 30],
      ["Nano", 20],
    ]
  );
  assert.ok(mix.every((tier) => tier.reasoning.includes("stated in the brief")));
});

test("named tiers only: exactly those tiers, split recommended from the industry mix", () => {
  const { mix, basis } = resolveCreatorTierMixFromPreference({
    preference: [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }],
    baseMix: BEAUTY_MIX,
  });

  assert.equal(basis, "brief_tiers_recommended_split");
  assert.deepEqual(
    mix.map((tier) => tier.tier),
    ["Macro", "Mid", "Micro"],
    "Nano is not in the brief, so it is not in the mix"
  );
  assert.equal(
    mix.reduce((sum, tier) => sum + tier.percent, 0),
    100,
    "the recommended split totals 100"
  );
  // Weighted by the industry recommendation (20 / 30 / 35), renormalized.
  assert.deepEqual(
    mix.map((tier) => tier.percent),
    [24, 35, 41]
  );
  assert.ok(
    mix.every((tier) => /recommended allocation/i.test(tier.reasoning)),
    "each tier says the split is a recommendation, not a brief fact"
  );
});

test("a named tier the industry mix does not use is still represented", () => {
  const { mix } = resolveCreatorTierMixFromPreference({
    preference: [{ tier: "Macro" }, { tier: "Celebrity" }],
    baseMix: BEAUTY_MIX,
  });

  assert.deepEqual(
    mix.map((tier) => tier.tier),
    ["Celebrity", "Macro"]
  );
  assert.ok(
    mix.every((tier) => tier.percent > 0),
    "a tier the brief asked for is never allocated nothing"
  );
  assert.equal(mix.reduce((sum, tier) => sum + tier.percent, 0), 100);
});

test("no preference leaves the existing recommendation exactly as it is", () => {
  const { mix, basis } = resolveCreatorTierMixFromPreference({
    preference: [],
    baseMix: BEAUTY_MIX,
  });

  assert.equal(basis, "recommended");
  assert.deepEqual(mix, BEAUTY_MIX, "the industry mix is passed through untouched");
});

test("a partial split still totals 100 without attributing figures to the brief", () => {
  // "Macro 50%, plus Mid and Micro" — one stated, two not.
  const { mix, basis } = resolveCreatorTierMixFromPreference({
    preference: [{ tier: "Macro", percent: 50 }, { tier: "Mid" }, { tier: "Micro" }],
    baseMix: BEAUTY_MIX,
  });

  assert.equal(basis, "brief_tiers_recommended_split");
  assert.equal(mix.reduce((sum, tier) => sum + tier.percent, 0), 100);
  assert.deepEqual(
    mix.map((tier) => tier.tier),
    ["Macro", "Mid", "Micro"]
  );
});
