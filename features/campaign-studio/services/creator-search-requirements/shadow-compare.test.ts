import assert from "node:assert/strict";
import test from "node:test";

import { mapCampaignIntelligenceToDiscoverySearch } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";
import { creatorSearchRequirementsToMappedFilters } from "./creator-search-requirements-to-filters";
import { compareCsrAgainstCurrentFilters, formatShadowComparison } from "./shadow-compare";

const NOW = "2026-01-01T00:00:00.000Z";

const validated: ValidatedCampaignIntelligence = {
  brand: { brandName: "BabyJoy" },
  market: { countryCode: "EG", countryLabel: "Egypt", cities: [] },
  audience: {
    countries: ["EG"],
    cities: [],
    gender: "female",
    ageMin: 28,
    ageMax: 40,
    languages: ["ar"],
  },
  creator: { niches: [], creatorTypes: [] },
  platforms: ["instagram"],
  categories: ["Parenting"],
  keywords: [],
  brandSafety: "none",
  fieldEvidence: {},
  validatedAt: NOW,
};

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 4,
  createdAt: NOW,
  understanding: {
    brand: "BabyJoy",
    objective: "Drive trial among Egyptian mothers",
    geography: "Egypt",
    audience: "Egyptian mothers aged 28-40",
    platforms: ["Instagram"],
    kpis: [{ metric: "Reach", target: "8M", why: "Penetration" }],
    risks: [],
    constraints: [],
  },
  narrative: "Parenting-led trust.",
  pillars: [{ title: "Parenting", what: "Family routines", why: "Peer trust" }],
  platformMix: [{ platform: "Instagram", role: "Reels", why: "Reach" }],
  creatorTierStrategy: [
    { tier: "Macro", allocationPercent: 40, why: "Reach" },
    { tier: "Micro", allocationPercent: 60, why: "Engagement" },
  ],
};

function profile(): CampaignIntelligenceProfile {
  return {
    schemaVersion: 1,
    status: "saved",
    extractedAt: NOW,
    confidence: {},
    sources: {},
    brandName: "BabyJoy",
    validatedIntelligence: validated,
  } as unknown as CampaignIntelligenceProfile;
}

test("shadow comparison reports the strategic signals Discovery cannot express", () => {
  const current = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });

  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: current,
    requirements,
    now: NOW,
  });

  const fields = comparison.strategicAdditions.map((a) => a.field);
  assert.ok(fields.includes("objective"));
  assert.ok(fields.includes("tierMix"));
  assert.ok(fields.includes("kpi"));
  assert.ok(fields.includes("contentPillar"));

  const tierMix = comparison.strategicAdditions.find((a) => a.field === "tierMix");
  assert.equal(tierMix?.detail, "Macro 40% · Micro 60%");
});

test("shared filters are recognised as shared, not as additions", () => {
  const current = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });

  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: current,
    requirements,
    now: NOW,
  });

  const shared = comparison.shared.map((s) => `${s.key}=${s.value}`);
  assert.ok(shared.includes("platform=instagram"));
  assert.ok(shared.includes("audience_country=EG"));
  assert.ok(shared.includes("category=Parenting"));
  assert.equal(comparison.currentFilterCount, current.length);
});

test("CSR additions over the current filter set are surfaced explicitly", () => {
  const current = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });

  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: current,
    requirements,
    now: NOW,
  });

  // Strategy pillars add a content keyword the CIP mapper never produced.
  assert.ok(
    comparison.onlyInCsr.some((f) => f.key === "content_keyword" && f.value === "Parenting"),
    "expected the strategy pillar to add a content keyword"
  );
  assert.equal(comparison.identicalFilters, false);
});

test("comparison records what CSR would drop relative to today", () => {
  const current = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });

  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: current,
    requirements,
    now: NOW,
  });

  // The CIP mapper infers creator_age_* from audience age; CSR does not.
  const currentKeys = new Set(current.map((f) => f.key));
  if (currentKeys.has("creator_age_min")) {
    assert.ok(comparison.onlyInCurrent.some((f) => f.key === "creator_age_min"));
  }
  assert.equal(
    comparison.onlyInCurrent.length + comparison.shared.length,
    comparison.currentFilterCount
  );
});

test("identical filter sets are reported as identical", () => {
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });
  const projected = creatorSearchRequirementsToMappedFilters(requirements).filters;

  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: projected,
    requirements,
    now: NOW,
  });

  assert.equal(comparison.identicalFilters, true);
  assert.deepEqual(comparison.onlyInCsr, []);
  assert.deepEqual(comparison.onlyInCurrent, []);
});

test("blocking gaps are surfaced in the comparison", () => {
  const requirements = buildCreatorSearchRequirements({ now: NOW });
  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: [],
    requirements,
    now: NOW,
  });

  assert.ok(comparison.blockingGaps.some((g) => g.startsWith("strategyRef:")));
  assert.ok(comparison.blockingGaps.some((g) => g.startsWith("search.platforms:")));
});

test("formatShadowComparison summarises the diff in one line", () => {
  const current = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });
  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: current,
    requirements,
    now: NOW,
  });

  const summary = formatShadowComparison(comparison);
  assert.match(summary, /CSR shadow:/);
  assert.match(summary, /strategic signal/);
});

test("the comparison references the strategy revision it was generated from", () => {
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });
  const comparison = compareCsrAgainstCurrentFilters({
    currentFilters: [],
    requirements,
    now: NOW,
  });
  assert.deepEqual(comparison.strategyRef, { id: "strategy-1", version: 4, createdAt: NOW });
});
