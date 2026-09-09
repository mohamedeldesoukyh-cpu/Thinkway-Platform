/**
 * Phase 2 — CSR merged into the live CIP Discovery filter set.
 *
 * The invariant under test throughout: the CIP set is never weakened. CSR can
 * only add requirements Discovery was not already asking for, and only when it
 * has something sound to add.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DISCOVERY_SEARCH_FILTER_KEYS,
  type DiscoveryMappedFilter,
} from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";
import { creatorSearchRequirementsToMappedFilters } from "./creator-search-requirements-to-filters";
import { mergeCsrFiltersIntoDiscoveryFilters } from "./merge-csr-into-discovery-filters";
import type { CreatorSearchRequirements } from "../../types/creator-search-requirements";

const NOW = "2026-01-01T00:00:00.000Z";

function cip(
  key: DiscoveryMappedFilter["key"],
  value: string,
  overrides?: Partial<DiscoveryMappedFilter>
): DiscoveryMappedFilter {
  return {
    id: `cip-${key}-${value}`,
    key,
    label: key,
    value,
    weight: 100,
    confidence: 0.9,
    ...overrides,
  };
}

const validated: ValidatedCampaignIntelligence = {
  brand: { brandName: "Tafareeh Tea" },
  market: { countryCode: "EG", countryLabel: "Egypt", cities: [] },
  audience: {
    countries: ["EG"],
    cities: [],
    gender: "any",
    languages: ["ar"],
  },
  creator: { niches: ["tea rituals"], creatorTypes: [] },
  platforms: ["instagram", "tiktok"],
  categories: ["Food"],
  keywords: ["tea"],
  brandSafety: "none",
  fieldEvidence: {},
  validatedAt: NOW,
};

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 2,
  createdAt: NOW,
  understanding: {
    brand: "Tafareeh Tea",
    objective: "Build awareness and encourage trial",
    geography: "Egypt",
    audience: "Egyptian tea drinkers, mainly young adults and families",
    platforms: ["Instagram", "TikTok"],
    kpis: [],
    risks: [],
    constraints: [],
  },
  narrative: "Everyday tea moments.",
  pillars: [{ title: "Food", what: "Tea rituals at home", why: "Daily habit" }],
  platformMix: [{ platform: "Instagram", role: "Reels", why: "Reach" }],
  creatorTierStrategy: [{ tier: "Micro", allocationPercent: 100, why: "Engagement" }],
};

function csr(
  overrides?: Parameters<typeof buildCreatorSearchRequirements>[0]
): CreatorSearchRequirements {
  return buildCreatorSearchRequirements({ strategy, validated, now: NOW, ...overrides });
}

// ---------------------------------------------------------------------------
// 1-4 — the safe defaults. CSR contributes nothing unless it soundly can.

test("absent CSR leaves the CIP filters untouched", () => {
  const current = [cip("category", "Food"), cip("platform", "instagram")];
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: undefined });

  assert.deepEqual(merged.filters, current);
  assert.deepEqual(merged.added, []);
});

test("null CSR leaves the CIP filters untouched", () => {
  const current = [cip("category", "Food")];
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: null });

  assert.deepEqual(merged.filters, current);
  assert.deepEqual(merged.added, []);
});

test("an empty CSR projection leaves the CIP filters untouched", () => {
  // No strategy, no validated intelligence, no facts — nothing projectable.
  const empty = buildCreatorSearchRequirements({ now: NOW });
  const current = [cip("category", "Food")];
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: empty });

  assert.deepEqual(merged.filters, current);
  assert.deepEqual(merged.added, []);
});

test("a CSR carrying a blocking gap contributes nothing, even when it projects", () => {
  const requirements = csr();
  const gapped: CreatorSearchRequirements = {
    ...requirements,
    gaps: [
      ...requirements.gaps,
      { field: "search.platforms", reason: "No platform stated.", blocking: true },
    ],
  };

  // Guard: this CSR really does have filters to offer.
  assert.ok(
    mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements }).added.length > 0
  );

  const current = [cip("category", "Food")];
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: gapped });

  assert.deepEqual(merged.filters, current);
  assert.deepEqual(merged.added, []);
  assert.ok(merged.skipped.some((entry) => entry.endsWith(":blocking_gap")));
});

// ---------------------------------------------------------------------------
// 5-6 — what CSR actually adds.

test("CSR adds creator_country derived from Strategy geography", () => {
  const current = [cip("category", "Food")];
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: csr() });

  const countries = merged.filters.filter((f) => f.key === "creator_country");
  assert.deepEqual(
    countries.map((f) => f.value),
    ["EG"]
  );
  assert.ok(merged.added.some((a) => a.key === "creator_country" && a.value === "EG"));
});

test("CSR adds category, platform, language and audience country requirements", () => {
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements: csr() });
  const byKey = (key: string) =>
    merged.filters.filter((f) => f.key === key).map((f) => f.value.toLowerCase());

  assert.deepEqual(byKey("platform").sort(), ["instagram", "tiktok"]);
  assert.ok(byKey("category").includes("food"));
  assert.ok(byKey("language").includes("ar"));
  assert.ok(byKey("audience_country").includes("eg"));
});

test("CSR never contributes a content keyword to the live search", () => {
  // The projection carries content topics; the merge must not hand them to
  // Discovery. Downstream they collapse to one FTS scalar, and their only
  // CSR-specific source is Strategy pillar TITLES — which on the pre-search
  // bootstrap strategy document are structural section names.
  const requirements = csr();
  const projected = creatorSearchRequirementsToMappedFilters(requirements).filters;
  assert.ok(
    projected.some((f) => f.key === "content_keyword"),
    "guard: this CSR really does project content keywords"
  );

  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements });

  assert.equal(merged.filters.filter((f) => f.key === "content_keyword").length, 0);
  assert.ok(merged.skipped.includes("content_keyword:not_projected_to_live_search"));
});

test("a CIP content keyword is still preserved through the merge", () => {
  const existing = cip("content_keyword", "tea", { id: "cip-keyword" });
  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: [existing],
    requirements: csr(),
  });

  const keywords = merged.filters.filter((f) => f.key === "content_keyword");
  assert.equal(keywords.length, 1);
  assert.equal(keywords[0], existing, "excluding CSR keywords must not touch CIP's");
});

// ---------------------------------------------------------------------------
// 7-8 — collisions. CIP always wins, and keeps its own provenance.

test("an exact collision keeps the CIP filter object, not the CSR one", () => {
  const existing = cip("category", "Food", { id: "cip-original", confidence: 0.72, weight: 100 });
  const current = [existing];
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: csr() });

  const categories = merged.filters.filter(
    (f) => f.key === "category" && f.value.toLowerCase() === "food"
  );
  assert.equal(categories.length, 1);
  assert.equal(categories[0], existing, "the CIP filter object itself must survive");
  assert.equal(categories[0]!.id, "cip-original");
  assert.equal(categories[0]!.confidence, 0.72);
});

test("collision matching ignores case and surrounding whitespace", () => {
  const existing = cip("category", " food ", { id: "cip-loose" });
  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: [existing],
    requirements: csr(),
  });

  const categories = merged.filters.filter((f) => f.key === "category");
  assert.equal(categories.length, 1);
  assert.equal(categories[0]!.id, "cip-loose");
});

// ---------------------------------------------------------------------------
// 9-10 — range keys are AND-narrowing and must never be doubled.

test("CSR does not add a second follower_min when the CIP set already has one", () => {
  const withFollowerFloor = csr({
    strategy,
    validated: { ...validated, creator: { ...validated.creator, followerMin: 50_000 } },
    now: NOW,
  });
  const existing = cip("follower_min", "10000", { id: "cip-follower" });

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: [existing],
    requirements: withFollowerFloor,
  });

  const floors = merged.filters.filter((f) => f.key === "follower_min");
  assert.equal(floors.length, 1, "a second follower_min would silently narrow the pool");
  assert.equal(floors[0]!.value, "10000");
  assert.ok(merged.skipped.includes("follower_min:range_key_already_set"));
});

test("CSR supplies follower_min when the CIP set has none", () => {
  const withFollowerFloor = csr({
    strategy,
    validated: { ...validated, creator: { ...validated.creator, followerMin: 50_000 } },
    now: NOW,
  });

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: [cip("category", "Food")],
    requirements: withFollowerFloor,
  });

  const floors = merged.filters.filter((f) => f.key === "follower_min");
  assert.equal(floors.length, 1);
  assert.equal(floors[0]!.value, "50000");
});

// ---------------------------------------------------------------------------
// 11-14 — what may never reach Discovery, and what may never be mutated.

test("a CSR requirement below the confidence floor never enters Discovery", () => {
  const requirements = csr();
  const lowConfidence: CreatorSearchRequirements = {
    ...requirements,
    search: {
      ...requirements.search,
      primaryCategories: requirements.search.primaryCategories.map((requirement) => ({
        ...requirement,
        value: "Gardening",
        id: "category:gardening",
        confidence: 0.4,
      })),
    },
  };

  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements: lowConfidence });

  assert.ok(
    !merged.filters.some((f) => f.value.toLowerCase() === "gardening"),
    "a sub-threshold requirement must stay out of the live search"
  );
});

test("no strategic-layer value becomes a Discovery filter", () => {
  const requirements = csr();
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements });
  const haystack = merged.filters
    .map((f) => `${f.key} ${f.label} ${f.value}`)
    .join(" ")
    .toLowerCase();

  assert.ok(requirements.strategic.objective, "fixture must carry an objective to be meaningful");
  assert.ok(!haystack.includes("encourage trial"));
  assert.ok(!haystack.includes("micro"), "tier mix is a portfolio decision, not a filter");
  for (const kpi of requirements.strategic.kpis) {
    assert.ok(!haystack.includes(kpi.metric.toLowerCase()));
  }
});

test("every merged filter key stays inside the Discovery allowlist", () => {
  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: [cip("verified", "true"), cip("content_tag", "unboxing")],
    requirements: csr(),
  });

  for (const filter of merged.filters) {
    assert.ok(
      (DISCOVERY_SEARCH_FILTER_KEYS as readonly string[]).includes(filter.key),
      `${filter.key} is not a Discovery filter key`
    );
  }
});

test("the caller's filter array is not mutated", () => {
  const current = [cip("category", "Food"), cip("platform", "instagram")];
  const snapshot = JSON.parse(JSON.stringify(current));

  mergeCsrFiltersIntoDiscoveryFilters({ current, requirements: csr() });

  assert.deepEqual(JSON.parse(JSON.stringify(current)), snapshot);
});
