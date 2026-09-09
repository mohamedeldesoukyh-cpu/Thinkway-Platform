/**
 * Phase 2 — everything Discovery asks for today must survive the CSR merge.
 *
 * The CIP mapper is two stages: the validated-intelligence allowlist mapping,
 * then `enrichBriefSearchSignals`, which infers platforms, youth signals,
 * telecom/technology keywords and thin-brief categories. CSR reproduces almost
 * none of that, so a replacement would silently gut retrieval. These tests pin
 * the additive contract against real CIP profiles run through the real mapper.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { mapCampaignIntelligenceToDiscoverySearch } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";
import { mergeCsrFiltersIntoDiscoveryFilters } from "./merge-csr-into-discovery-filters";

const NOW = "2026-01-01T00:00:00.000Z";

function validatedFor(input: {
  brandName: string;
  categories?: string[];
  platforms?: string[];
  keywords?: string[];
  niches?: string[];
  ageMin?: number;
  ageMax?: number;
}): ValidatedCampaignIntelligence {
  return {
    brand: { brandName: input.brandName },
    market: { countryCode: "EG", countryLabel: "Egypt", cities: [] },
    audience: {
      countries: ["EG"],
      cities: [],
      gender: "any",
      languages: ["ar"],
      ...(input.ageMin != null ? { ageMin: input.ageMin } : {}),
      ...(input.ageMax != null ? { ageMax: input.ageMax } : {}),
    },
    creator: { niches: input.niches ?? [], creatorTypes: [] },
    platforms: (input.platforms ?? []) as ValidatedCampaignIntelligence["platforms"],
    categories: input.categories ?? [],
    keywords: input.keywords ?? [],
    brandSafety: "none",
    fieldEvidence: {},
    validatedAt: NOW,
  };
}

function profileFor(
  validated: ValidatedCampaignIntelligence,
  extra?: Partial<CampaignIntelligenceProfile>
): CampaignIntelligenceProfile {
  return {
    schemaVersion: 1,
    status: "saved",
    extractedAt: NOW,
    confidence: {},
    sources: {},
    brandName: validated.brand.brandName,
    validatedIntelligence: validated,
    ...extra,
  } as unknown as CampaignIntelligenceProfile;
}

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 1,
  createdAt: NOW,
  understanding: {
    brand: "Brand",
    objective: "Awareness",
    geography: "Egypt",
    audience: "Egyptian consumers",
    platforms: ["Instagram"],
    kpis: [],
    risks: [],
    constraints: [],
  },
  narrative: "Narrative.",
  pillars: [{ title: "Lifestyle", what: "Daily moments", why: "Relatability" }],
  platformMix: [{ platform: "Instagram", role: "Reels", why: "Reach" }],
  creatorTierStrategy: [{ tier: "Micro", allocationPercent: 100, why: "Engagement" }],
};

/** Every CIP filter must still be present, by key+value, after the merge. */
function assertCipPreserved(
  cipFilters: readonly DiscoveryMappedFilter[],
  merged: readonly DiscoveryMappedFilter[]
): void {
  const mergedKeys = new Set(
    merged.map((f) => `${f.key}:${f.value.trim().toLowerCase()}`)
  );
  for (const filter of cipFilters) {
    const identity = `${filter.key}:${filter.value.trim().toLowerCase()}`;
    assert.ok(mergedKeys.has(identity), `CIP filter ${identity} was dropped by the merge`);
  }
}

test("telecom/youth enrichment survives the merge intact", () => {
  const profile = profileFor(validatedFor({ brandName: "Etisalat", platforms: [] }), {
    rawBriefExcerpt: "Etisalat 5G launch for Gen Z across Egypt.",
  });
  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(profile).filters;
  const requirements = buildCreatorSearchRequirements({ strategy, now: NOW });

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: cipFilters,
    requirements,
  }).filters;

  assertCipPreserved(cipFilters, merged);

  const values = merged.map((f) => `${f.key}:${f.value.toLowerCase()}`);
  assert.ok(values.includes("content_keyword:5g"), "telecom keyword enrichment lost");
  assert.ok(values.includes("content_keyword:telecom"), "telecom keyword enrichment lost");
  assert.ok(values.includes("category:technology"), "telecom category enrichment lost");
  assert.ok(values.includes("category:entertainment"), "telecom category enrichment lost");
  assert.ok(values.includes("platform:tiktok"), "telecom default platform lost");
  assert.ok(values.includes("audience_age_min:18"), "youth age floor lost");
  assert.ok(values.includes("audience_age_max:24"), "youth age ceiling lost");
});

test("thin-brief category inference survives the merge", () => {
  const profile = profileFor(validatedFor({ brandName: "Glow" }), {
    rawBriefExcerpt: "A skincare and dermatology launch in Egypt.",
  });
  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(profile).filters;

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: cipFilters,
    requirements: buildCreatorSearchRequirements({ strategy, now: NOW }),
  }).filters;

  assertCipPreserved(cipFilters, merged);
  const values = merged.map((f) => `${f.key}:${f.value.toLowerCase()}`);
  assert.ok(values.includes("category:beauty"), "thin-brief Beauty inference lost");
});

test("creator age bounds — which CSR cannot express — survive the merge", () => {
  // The CIP mapper derives creator_age_* from the validated AUDIENCE age band.
  // CSR has no creator-age requirement at all, so these exist only because the
  // CIP mapper produced them.
  const withCreatorAges = validatedFor({
    brandName: "Brand",
    categories: ["Food"],
    ageMin: 25,
    ageMax: 45,
  });
  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(
    profileFor(withCreatorAges)
  ).filters;

  // Guard: the fixture really does produce creator age filters.
  assert.ok(cipFilters.some((f) => f.key === "creator_age_min"));

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: cipFilters,
    requirements: buildCreatorSearchRequirements({ strategy, validated: withCreatorAges, now: NOW }),
  }).filters;

  assertCipPreserved(cipFilters, merged);
  assert.equal(merged.filter((f) => f.key === "creator_age_min").length, 1);
  assert.equal(merged.filter((f) => f.key === "creator_age_max").length, 1);
});

test("content_tag and verified — which CSR cannot express — survive the merge", () => {
  const cipFilters: DiscoveryMappedFilter[] = [
    { id: "t", key: "content_tag", label: "Content Tag", value: "unboxing", weight: 70, confidence: 0.62 },
    { id: "v", key: "verified", label: "Verified", value: "true", weight: 80, confidence: 0.85 },
  ];

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: cipFilters,
    requirements: buildCreatorSearchRequirements({ strategy, now: NOW }),
  }).filters;

  assertCipPreserved(cipFilters, merged);
});

test("brand_fit_min from a luxury market tier survives the merge", () => {
  const cipFilters: DiscoveryMappedFilter[] = [
    { id: "b", key: "brand_fit_min", label: "Brand Fit", value: "70", weight: 80, confidence: 0.75 },
  ];

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: cipFilters,
    requirements: buildCreatorSearchRequirements({ strategy, now: NOW }),
  }).filters;

  assertCipPreserved(cipFilters, merged);
  assert.equal(merged.filter((f) => f.key === "brand_fit_min").length, 1);
});

test("the merge never reintroduces a client-industry category the CIP mapper stripped", () => {
  // enrichBriefSearchSignals removes Finance/Telecom style labels: a client's
  // own industry is not a creator vertical. CSR must not smuggle one back.
  const validated = validatedFor({ brandName: "NBE", categories: ["Finance", "Food"] });
  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(profileFor(validated)).filters;

  assert.ok(
    !cipFilters.some((f) => f.key === "category" && /finance/i.test(f.value)),
    "guard: the CIP mapper is expected to strip the client industry"
  );

  const merged = mergeCsrFiltersIntoDiscoveryFilters({
    current: cipFilters,
    requirements: buildCreatorSearchRequirements({ strategy, validated, now: NOW }),
  }).filters;

  assertCipPreserved(cipFilters, merged);
  assert.ok(
    !merged.some((f) => f.key === "category" && /finance/i.test(f.value)),
    "CSR must not reintroduce the stripped client-industry category"
  );
});
