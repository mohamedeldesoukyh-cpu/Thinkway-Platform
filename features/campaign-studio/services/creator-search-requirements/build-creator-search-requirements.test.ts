import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";

const NOW = "2026-01-01T00:00:00.000Z";

function strategy(overrides: Partial<CampaignStrategyDocument> = {}): CampaignStrategyDocument {
  return {
    id: "strategy-1",
    version: 3,
    createdAt: NOW,
    understanding: {
      brand: "BabyJoy",
      industry: "Baby & Parenting",
      objective: "Drive awareness and trial among Egyptian mothers",
      geography: "Egypt",
      audience: "Egyptian mothers aged 28-40",
      platforms: ["Instagram"],
      kpis: [{ metric: "Reach", target: "8M", why: "Category penetration" }],
      risks: [],
      constraints: ["No competitor diaper brands"],
    },
    narrative: "Parenting-led trust building.",
    pillars: [
      { title: "Parenting", what: "Real routines", why: "Mothers trust peers" },
      { title: "Lifestyle", what: "Family moments", why: "Broadens reach" },
    ],
    platformMix: [{ platform: "Instagram", role: "Reels", why: "Highest reach" }],
    creatorTierStrategy: [
      { tier: "Macro", allocationPercent: 35, why: "Trusted mom voices at scale" },
      { tier: "Micro", allocationPercent: 40, why: "Niche parenting communities" },
      { tier: "Nano", allocationPercent: 25, why: "Long-tail authenticity" },
    ],
    ...overrides,
  };
}

function validated(
  overrides: Partial<ValidatedCampaignIntelligence> = {}
): ValidatedCampaignIntelligence {
  return {
    brand: { brandName: "BabyJoy" },
    market: { countryCode: "EG", countryLabel: "Egypt", cities: ["Cairo"] },
    audience: {
      countries: ["EG"],
      cities: [],
      gender: "female",
      ageMin: 28,
      ageMax: 40,
      languages: ["ar"],
    },
    creator: {
      niches: ["motherhood"],
      creatorTypes: [],
      followerMin: 20_000,
      followerMax: 800_000,
      engagementMin: 2,
    },
    platforms: ["instagram"],
    categories: ["Parenting", "Beauty"],
    keywords: ["diapers"],
    brandSafety: "required",
    fieldEvidence: { platforms: { level: "extracted", confidence: 0.95 } },
    validatedAt: NOW,
    ...overrides,
  };
}

function facts(overrides: Partial<CampaignFacts> = {}): CampaignFacts {
  return {
    brandName: "BabyJoy",
    industry: "Baby & Parenting",
    objective: "Awareness",
    geography: ["Egypt"],
    platforms: ["Instagram"],
    audience: "Mothers",
    budget: { amount: 2_000_000, currency: "EGP" },
    durationWeeks: 6,
    extractedAt: NOW,
    confidence: {},
    sources: {},
    ...overrides,
  };
}

// 1 — Strategy → CSR ---------------------------------------------------------

test("Strategy populates the strategic layer and is referenced by version", () => {
  const csr = buildCreatorSearchRequirements({ strategy: strategy(), now: NOW });

  assert.equal(csr.schemaVersion, 1);
  assert.deepEqual(csr.strategyRef, { id: "strategy-1", version: 3, createdAt: NOW });
  assert.equal(csr.generatedAt, NOW);
  assert.match(csr.strategic.objective, /Egyptian mothers/);
  assert.equal(csr.strategic.kpis.length, 1);
  assert.equal(csr.strategic.contentPillars.length, 2);
  assert.deepEqual(
    csr.strategic.contentFormats.map((f) => f.value),
    ["Reels"]
  );
});

// 5 — creatorTierStrategy → tierMix ------------------------------------------

test("strategy.creatorTierStrategy becomes strategic.tierMix with canonical tiers", () => {
  const csr = buildCreatorSearchRequirements({ strategy: strategy(), now: NOW });

  assert.deepEqual(csr.strategic.tierMix, [
    { tier: "Macro", percent: 35, why: "Trusted mom voices at scale" },
    { tier: "Micro", percent: 40, why: "Niche parenting communities" },
    { tier: "Nano", percent: 25, why: "Long-tail authenticity" },
  ]);
});

test("objectiveKind is classified from the strategy objective", () => {
  const csr = buildCreatorSearchRequirements({ strategy: strategy(), now: NOW });
  assert.equal(csr.strategic.objectiveKind, "awareness");
});

// 2 — Validated Intelligence → CSR -------------------------------------------

test("validated intelligence populates searchable demographics and guardrails", () => {
  const csr = buildCreatorSearchRequirements({ validated: validated(), now: NOW });

  assert.equal(csr.search.audienceGender?.value, "female");
  assert.equal(csr.search.audienceAgeMin?.value, 28);
  assert.equal(csr.search.audienceAgeMax?.value, 40);
  assert.equal(csr.search.followerFloor?.value, 20_000);
  assert.equal(csr.search.followerCeiling?.value, 800_000);
  assert.equal(csr.search.engagementFloor?.value, 2);
  assert.equal(csr.search.brandSafety, "required");
  assert.deepEqual(
    csr.search.languages.map((l) => l.value),
    ["ar"]
  );
  assert.deepEqual(
    csr.search.niches.map((n) => n.value),
    ["motherhood"]
  );
  assert.deepEqual(
    csr.search.cities.map((c) => c.value),
    ["Cairo"]
  );
});

// 3 — Precedence rules -------------------------------------------------------

test("operator override outranks strategy for platforms", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy(),
    validated: validated(),
    facts: facts(),
    overrides: { platforms: ["TikTok"] },
    now: NOW,
  });

  assert.deepEqual(
    csr.search.platforms.map((p) => p.value),
    ["tiktok"]
  );
  assert.equal(csr.search.platforms[0]?.source, "operator");
});

test("strategy outranks validated intelligence and facts for platforms", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy({
      understanding: { ...strategy().understanding, platforms: ["YouTube"] },
    }),
    validated: validated(),
    facts: facts(),
    now: NOW,
  });

  assert.deepEqual(
    csr.search.platforms.map((p) => p.value),
    ["youtube"]
  );
  assert.equal(csr.search.platforms[0]?.source, "strategy");
});

test("validated intelligence is used when strategy states no platform", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy({ understanding: { ...strategy().understanding, platforms: [] } }),
    validated: validated(),
    facts: facts(),
    now: NOW,
  });

  assert.deepEqual(
    csr.search.platforms.map((p) => p.value),
    ["instagram"]
  );
  assert.equal(csr.search.platforms[0]?.source, "validated_intel");
});

test("facts are the last resort for platforms", () => {
  const csr = buildCreatorSearchRequirements({ facts: facts(), now: NOW });
  assert.deepEqual(
    csr.search.platforms.map((p) => p.value),
    ["instagram"]
  );
  assert.equal(csr.search.platforms[0]?.source, "facts");
});

test("audience markets prefer validated intelligence over strategy geography", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy(),
    validated: validated(),
    now: NOW,
  });

  assert.deepEqual(
    csr.search.audienceCountries.map((c) => c.value),
    ["EG"]
  );
  assert.equal(csr.search.audienceCountries[0]?.source, "validated_intel");
  assert.equal(csr.search.creatorCountries[0]?.value, "EG");
  assert.equal(csr.search.creatorCountries[0]?.source, "strategy");
});

// 4 — Category provenance ----------------------------------------------------

test("categories come from strategy pillars with source=strategy, not regex", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy(),
    facts: facts({ rawBriefExcerpt: "A beauty and skincare campaign" }),
    now: NOW,
  });

  const parenting = csr.search.primaryCategories.find((c) => c.value === "Parenting");
  assert.ok(parenting, "expected Parenting to be derived from the strategy pillar");
  assert.equal(parenting.source, "strategy");
  assert.match(parenting.rationale, /Strategy pillar/);

  // The regex fallback would have produced Beauty from rawBriefExcerpt.
  assert.equal(
    csr.search.primaryCategories.some((c) => c.source === "brief_regex_fallback"),
    false
  );
});

test("validated categories are recorded with source=validated_intel", () => {
  const csr = buildCreatorSearchRequirements({ validated: validated(), now: NOW });
  const parenting = csr.search.primaryCategories.find((c) => c.value === "Parenting");
  assert.equal(parenting?.source, "validated_intel");
});

test("regex derivation is used only when strategy and validated produce nothing", () => {
  const csr = buildCreatorSearchRequirements({
    facts: facts({ rawBriefExcerpt: "A beauty and skincare launch" }),
    now: NOW,
  });

  const beauty = csr.search.primaryCategories.find((c) => c.value === "Beauty");
  assert.ok(beauty, "expected the regex fallback to still work");
  assert.equal(beauty.source, "brief_regex_fallback");
  assert.equal(
    csr.gaps.some((g) => g.field === "search.primaryCategories" && !g.blocking),
    true
  );
});

test("secondary categories hold validated categories outside the primary set", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy(),
    validated: validated(),
    now: NOW,
  });

  // Parenting + Lifestyle come from pillars; Beauty is validated-only.
  assert.equal(
    csr.search.primaryCategories.some((c) => c.value === "Beauty"),
    true,
    "validated categories also seed the primary set"
  );
  assert.equal(csr.search.secondaryCategories.length, 0);
});

// 8 — Missing information creates gaps ---------------------------------------

test("missing strategy is a blocking gap and never invented", () => {
  const csr = buildCreatorSearchRequirements({ now: NOW });

  assert.equal(csr.strategyRef, undefined);
  assert.equal(csr.strategic.objective, "");
  assert.deepEqual(csr.strategic.tierMix, []);
  assert.deepEqual(csr.strategic.kpis, []);

  const blocking = csr.gaps.filter((g) => g.blocking).map((g) => g.field);
  assert.ok(blocking.includes("strategyRef"));
  assert.ok(blocking.includes("strategic.objective"));
  assert.ok(blocking.includes("search.platforms"));
  assert.ok(blocking.includes("search.geography"));
  assert.ok(blocking.includes("search.primaryCategories"));
});

test("a strategy with no tier allocation records a non-blocking gap", () => {
  const csr = buildCreatorSearchRequirements({
    strategy: strategy({ creatorTierStrategy: [] }),
    validated: validated(),
    now: NOW,
  });

  assert.deepEqual(csr.strategic.tierMix, []);
  const gap = csr.gaps.find((g) => g.field === "strategic.tierMix");
  assert.ok(gap);
  assert.equal(gap.blocking, false);
});

test("strategy constraints are captured as exclusions", () => {
  const csr = buildCreatorSearchRequirements({ strategy: strategy(), now: NOW });
  assert.deepEqual(csr.search.exclusions.keywords, ["No competitor diaper brands"]);
});

test("field evidence is carried through from validated intelligence", () => {
  const csr = buildCreatorSearchRequirements({ validated: validated(), now: NOW });
  assert.equal(csr.fieldEvidence.platforms?.confidence, 0.95);
});
