import assert from "node:assert/strict";
import test from "node:test";

import { DISCOVERY_SEARCH_FILTER_KEYS } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";
import { creatorSearchRequirementsToMappedFilters } from "./creator-search-requirements-to-filters";

const NOW = "2026-01-01T00:00:00.000Z";

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 2,
  createdAt: NOW,
  understanding: {
    brand: "BabyJoy",
    objective: "Drive awareness among Egyptian mothers",
    geography: "Egypt",
    audience: "Egyptian mothers aged 28-40",
    platforms: ["Instagram"],
    kpis: [{ metric: "Reach", target: "8M", why: "Penetration" }],
    risks: [],
    constraints: ["No competitor diaper brands"],
  },
  narrative: "Parenting-led trust.",
  pillars: [{ title: "Parenting", what: "Real routines", why: "Peer trust" }],
  platformMix: [{ platform: "Instagram", role: "Reels", why: "Reach" }],
  creatorTierStrategy: [
    { tier: "Macro", allocationPercent: 40, why: "Reach" },
    { tier: "Micro", allocationPercent: 60, why: "Engagement" },
  ],
};

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
  creator: { niches: ["motherhood"], creatorTypes: [], followerMin: 20_000, engagementMin: 2 },
  platforms: ["instagram"],
  categories: ["Parenting"],
  keywords: ["diapers"],
  brandSafety: "required",
  fieldEvidence: {},
  validatedAt: NOW,
};

function project() {
  return creatorSearchRequirementsToMappedFilters(
    buildCreatorSearchRequirements({ strategy, validated, now: NOW })
  );
}

// 6 — CSR → DiscoveryMappedFilter -------------------------------------------

test("projection produces valid DiscoveryMappedFilter shapes", () => {
  const { filters } = project();
  assert.ok(filters.length > 0);

  for (const filter of filters) {
    assert.equal(typeof filter.id, "string");
    assert.ok(filter.id.length > 0);
    assert.ok(
      (DISCOVERY_SEARCH_FILTER_KEYS as readonly string[]).includes(filter.key),
      `key ${filter.key} is not on the Discovery allowlist`
    );
    assert.equal(typeof filter.label, "string");
    assert.ok(filter.label.length > 0);
    assert.equal(typeof filter.value, "string");
    assert.ok(filter.value.length > 0);
    assert.equal(typeof filter.weight, "number");
    assert.ok(filter.confidence >= 0.55, "confidence floor mirrors the CIP mapper");
  }
});

test("projection maps each searchable requirement to its Discovery key", () => {
  const { filters } = project();
  const pairs = filters.map((f) => `${f.key}=${f.value}`);

  assert.ok(pairs.includes("platform=instagram"));
  assert.ok(pairs.includes("creator_country=EG"));
  assert.ok(pairs.includes("audience_country=EG"));
  assert.ok(pairs.includes("language=ar"));
  assert.ok(pairs.includes("category=Parenting"));
  assert.ok(pairs.includes("niche=motherhood"));
  assert.ok(pairs.includes("audience_gender=female"));
  assert.ok(pairs.includes("audience_age_min=28"));
  assert.ok(pairs.includes("audience_age_max=40"));
  assert.ok(pairs.includes("follower_min=20000"));
  assert.ok(pairs.includes("engagement_min=2"));
  assert.ok(pairs.includes("brand_safety_min=70"));
});

test("projection is deterministic and de-duplicated", () => {
  const first = project().filters;
  const second = project().filters;
  assert.deepEqual(first, second);

  const keys = first.map((f) => `${f.key}:${f.value.toLowerCase()}`);
  assert.equal(new Set(keys).size, keys.length);
});

// 7 — Unsupported strategic fields remain Layer 2 ----------------------------

test("no strategic-layer field is ever projected as a Discovery filter", () => {
  const requirements = buildCreatorSearchRequirements({ strategy, validated, now: NOW });
  const { filters, skipped } = creatorSearchRequirementsToMappedFilters(requirements);

  const values = filters.map((f) => f.value.toLowerCase());
  assert.equal(values.includes("drive awareness among egyptian mothers"), false);
  assert.equal(values.includes("reach"), false, "KPI metric must not become a filter");
  assert.equal(values.includes("macro"), false, "tier mix must not become a filter");

  assert.ok(skipped.includes("strategic.objective:not_searchable"));
  assert.ok(skipped.includes("strategic.kpis:not_searchable"));
  assert.ok(skipped.includes("strategic.tierMix:not_searchable"));
  assert.ok(skipped.includes("strategic.contentPillars:not_searchable"));
  assert.ok(skipped.includes("strategic.contentFormats:not_searchable"));

  // The strategic layer still holds them.
  assert.equal(requirements.strategic.tierMix.length, 2);
  assert.equal(requirements.strategic.kpis.length, 1);
});

test("exclusions are reported as unprojectable — no Discovery key exists", () => {
  const { filters, skipped } = project();
  assert.ok(skipped.includes("search.exclusions:no_discovery_key"));
  assert.equal(
    filters.some((f) => f.value.includes("competitor")),
    false
  );
});

test("content pillars project as content keywords, not as categories", () => {
  const { filters } = project();
  const keywordValues = filters.filter((f) => f.key === "content_keyword").map((f) => f.value);
  assert.ok(keywordValues.includes("Parenting"));
  assert.ok(keywordValues.includes("diapers"));
});

test("brand safety below 'required' does not emit a brand safety filter", () => {
  const requirements = buildCreatorSearchRequirements({
    strategy,
    validated: { ...validated, brandSafety: "preferred" },
    now: NOW,
  });
  const { filters } = creatorSearchRequirementsToMappedFilters(requirements);
  assert.equal(
    filters.some((f) => f.key === "brand_safety_min"),
    false
  );
});

test("an empty CSR projects to no filters rather than throwing", () => {
  const requirements = buildCreatorSearchRequirements({ now: NOW });
  const { filters } = creatorSearchRequirementsToMappedFilters(requirements);
  assert.deepEqual(filters, []);
});
