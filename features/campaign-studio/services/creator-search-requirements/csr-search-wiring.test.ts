/**
 * Phase 2 — the wiring that puts CSR in front of live Discovery.
 *
 * Three links have to hold, and each has its own way of failing silently:
 *
 *  1. CSR is built from workflow state BEFORE the search-creators task.
 *  2. It survives `ContextBuilder`, which allowlists AiContext fields — an
 *     un-listed property is dropped with no error and no type failure.
 *  3. The merged filter set is a superset of today's at the browse-parameter
 *     level, i.e. after the conversion that actually reaches SQL, and is
 *     byte-identical to today's when no CSR is supplied.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ContextBuilder } from "@/features/ai/shared/context-builder";
import type { AiRequest } from "@/features/ai/types";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";
import {
  discoveryMappedFiltersToBrowseFilters,
  mapCampaignIntelligenceToDiscoverySearch,
} from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import { preferCategoryBrowseOverKeywordSearch } from "@/features/campaign-intelligence-profile/services/search-creators-from-profile";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import type { ValidatedCampaignIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";

import { buildPreSearchCreatorSearchRequirements } from "./attach-creator-search-requirements";
import { buildCreatorSearchRequirements } from "./build-creator-search-requirements";
import { mergeCsrFiltersIntoDiscoveryFilters } from "./merge-csr-into-discovery-filters";

const NOW = "2026-01-01T00:00:00.000Z";

const validated: ValidatedCampaignIntelligence = {
  brand: { brandName: "Tafareeh Tea" },
  market: { countryCode: "EG", countryLabel: "Egypt", cities: [] },
  audience: { countries: ["EG"], cities: [], gender: "any", languages: ["ar"] },
  creator: { niches: [], creatorTypes: [] },
  platforms: ["instagram", "tiktok"],
  categories: ["Food"],
  keywords: ["tea"],
  brandSafety: "none",
  fieldEvidence: {},
  validatedAt: NOW,
};

const strategy: CampaignStrategyDocument = {
  id: "strategy-1",
  version: 3,
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

const facts = {
  brandName: "Tafareeh Tea",
  clientName: "Tafareeh Tea",
  objective: "Build awareness and encourage trial",
  audience: "Egyptian tea drinkers, mainly young adults and families",
  geography: ["Egypt"],
  platforms: ["instagram", "tiktok"],
  creatorCategories: ["Food"],
  durationWeeks: 2,
  kpis: [],
  sources: {},
  confidence: {},
} as unknown as CampaignFacts;

/** The workflow-state shape the engine holds when it reaches search-creators. */
function workflowStateData(): Record<string, unknown> {
  return {
    campaignStrategyDocument: strategy,
    validatedCampaignIntelligence: validated,
    validatedCampaignIntelligenceProfileId: "profile-1",
    campaignFacts: facts,
    campaignIntelligenceProfileId: "profile-1",
  };
}

function profile(): CampaignIntelligenceProfile {
  return {
    schemaVersion: 1,
    status: "saved",
    extractedAt: NOW,
    confidence: {},
    sources: {},
    brandName: "Tafareeh Tea",
    validatedIntelligence: validated,
  } as unknown as CampaignIntelligenceProfile;
}

// ---------------------------------------------------------------------------
// Link 1 — CSR exists, built from state, before search.

test("CSR is built from the workflow state the engine holds before search-creators", () => {
  const requirements = buildPreSearchCreatorSearchRequirements(workflowStateData(), NOW);

  assert.equal(requirements.campaignIntelligenceProfileId, "profile-1");
  assert.deepEqual(requirements.strategyRef, {
    id: "strategy-1",
    version: 3,
    createdAt: NOW,
  });
  assert.ok(requirements.search.platforms.length > 0, "platforms must resolve");
  assert.ok(requirements.search.primaryCategories.length > 0, "categories must resolve");
  assert.ok(
    requirements.search.creatorCountries.length > 0,
    "Strategy geography must reach the search layer"
  );
  assert.ok(!requirements.gaps.some((gap) => gap.blocking));
});

test("the pre-search builder never invents anything from an empty state", () => {
  const requirements = buildPreSearchCreatorSearchRequirements({}, NOW);

  assert.equal(requirements.strategyRef, undefined);
  assert.deepEqual(requirements.search.platforms, []);
  assert.deepEqual(requirements.search.primaryCategories, []);
  assert.ok(
    requirements.gaps.some((gap) => gap.blocking),
    "an empty state must be recorded as blocking, not filled in"
  );

  // And a blocking CSR contributes nothing to Discovery.
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements });
  assert.deepEqual(merged.filters, []);
});

test("the pre-search builder needs no budget and no database", () => {
  const data = workflowStateData();
  assert.equal((data.campaignFacts as CampaignFacts).budget, undefined);

  const requirements = buildPreSearchCreatorSearchRequirements(data, NOW);
  assert.equal(requirements.strategic.budget, undefined);
  assert.ok(mergeCsrFiltersIntoDiscoveryFilters({ current: [], requirements }).added.length > 0);
});

// ---------------------------------------------------------------------------
// Link 2 — the AiContext allowlist.

test("ContextBuilder preserves creatorSearchRequirements from the request context", async () => {
  const requirements = buildPreSearchCreatorSearchRequirements(workflowStateData(), NOW);
  const request: AiRequest = {
    id: "req-1",
    message: "search creators",
    context: { workspace: { type: "campaign" }, creatorSearchRequirements: requirements },
  };

  const context = await new ContextBuilder().build({ request });

  assert.equal(
    context.creatorSearchRequirements,
    requirements,
    "the context builder allowlists fields — an unlisted one is silently dropped"
  );
});

test("ContextBuilder preserves creatorSearchRequirements passed as builder input", async () => {
  const requirements = buildPreSearchCreatorSearchRequirements(workflowStateData(), NOW);
  const request: AiRequest = { id: "req-2", message: "search creators" };

  const context = await new ContextBuilder().build({
    request,
    creatorSearchRequirements: requirements,
  });

  assert.equal(context.creatorSearchRequirements, requirements);
});

test("ContextBuilder leaves creatorSearchRequirements undefined when nothing supplies it", async () => {
  const context = await new ContextBuilder().build({
    request: { id: "req-3", message: "search creators" },
  });

  assert.equal(context.creatorSearchRequirements, undefined);
});

// ---------------------------------------------------------------------------
// Link 3 — browse parameters, i.e. what actually reaches SQL.

/** The exact composition `searchCreatorsFromProfileData` performs at its seam. */
function browseFiltersFor(requirements?: Parameters<
  typeof mergeCsrFiltersIntoDiscoveryFilters
>[0]["requirements"]) {
  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const merged = mergeCsrFiltersIntoDiscoveryFilters({ current: cipFilters, requirements });
  return preferCategoryBrowseOverKeywordSearch({
    ...discoveryMappedFiltersToBrowseFilters(merged.filters, 1, 50),
    campaignIntelligenceProfileId: "profile-1",
  });
}

test("without CSR the browse parameters are exactly today's", () => {
  const cipFilters = mapCampaignIntelligenceToDiscoverySearch(profile()).filters;
  const today = preferCategoryBrowseOverKeywordSearch({
    ...discoveryMappedFiltersToBrowseFilters(cipFilters, 1, 50),
    campaignIntelligenceProfileId: "profile-1",
  });

  assert.deepEqual(browseFiltersFor(undefined), today);
  assert.deepEqual(browseFiltersFor(null), today);
});

test("with CSR the browse parameters keep every value they had and add no duplicates", () => {
  const requirements = buildPreSearchCreatorSearchRequirements(workflowStateData(), NOW);
  const before = browseFiltersFor(undefined) as Record<string, unknown>;
  const after = browseFiltersFor(requirements) as Record<string, unknown>;

  for (const [key, value] of Object.entries(before)) {
    if (Array.isArray(value)) {
      const next = after[key];
      assert.ok(Array.isArray(next), `${key} must remain an array`);
      for (const entry of value) {
        assert.ok(
          (next as unknown[]).includes(entry),
          `${key} lost the existing value ${String(entry)}`
        );
      }
      assert.equal(
        new Set(next as unknown[]).size,
        (next as unknown[]).length,
        `${key} must not contain duplicates`
      );
      continue;
    }
    // Scalars are single-valued AND filters: CSR must never overwrite one.
    if (value !== undefined) {
      assert.deepEqual(after[key], value, `${key} was overwritten by CSR`);
    }
  }
});

test("a CSR built with no Strategy leaves the browse parameters unchanged", () => {
  // Facts and validated intelligence only — CSR then restates what CIP already
  // knows, so nothing new should reach SQL.
  const factsOnly = buildCreatorSearchRequirements({ validated, facts, now: NOW });
  assert.deepEqual(browseFiltersFor(factsOnly), browseFiltersFor(undefined));
});
