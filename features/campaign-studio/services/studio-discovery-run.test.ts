/**
 * The Creator stage could not run Discovery.
 *
 * Discovery only ever executed as the create-campaign workflow's
 * `search-creators` task, so a campaign whose workflow produced no creators sat
 * on an accurate but unactionable "Inventory has not been searched yet" with no
 * affordance. These tests cover the state distinction and the write that the
 * new operator action performs — the write itself is the same assembly the
 * workflow route uses.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";

import { applyDiscoverySearchResultToCampaignObject } from "./apply-discovery-search-result";
import { resolveStudioDiscoverySufficiency } from "./studio-discovery-sufficiency";

const NOW = "2026-04-01T00:00:00.000Z";

const FACTS: CampaignFacts = {
  brandName: "Kérastase",
  industry: "Beauty & Personal Care",
  objective: "Drive Consideration & Conversion",
  audience: "Women aged 20–40 in Egypt",
  geography: ["Egypt"],
  platforms: ["instagram", "tiktok"],
  budget: { amount: 3_000_000, currency: "EGP" },
  durationWeeks: 4,
  creatorTiers: [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }],
  extractedAt: NOW,
  confidence: {},
  sources: { creatorTiers: "brief" },
};

function campaignObject(overrides?: Record<string, unknown>): CampaignObject {
  const section = (content = "") => ({ status: "complete" as const, content, data: {} });
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      summary: section("Kérastase"),
      audience: section(),
      strategy: section(),
      creators: { status: "pending", content: "", data: { ...(overrides ?? {}) } },
      budget: section(),
      timeline: section(),
      performance: section(),
      presentation: section(),
      operations: section(),
    },
    meta: { status: "complete", specialistProgress: [], campaignFacts: FACTS, studioIntakeConfirmedAt: NOW },
  } as unknown as CampaignObject;
}

function creator(id: string): GroundedCreator {
  return {
    id,
    displayName: `Creator ${id}`,
    handle: `creator_${id}`,
    platform: "instagram",
    followers: 120_000,
    engagementRate: 3.4,
    country: "Egypt",
  } as unknown as GroundedCreator;
}

// ---------------------------------------------------------------------------
// State accuracy (Part 9).

test("never searched reads as ready to run, not as an empty result", () => {
  const sufficiency = resolveStudioDiscoverySufficiency(campaignObject(), false);

  assert.equal(sufficiency.state, "discovery_ready");
  assert.match(sufficiency.detail, /has not been searched yet/);
  assert.equal(sufficiency.inventoryCount, 0);
});

test("a search in flight reads as running", () => {
  const sufficiency = resolveStudioDiscoverySufficiency(campaignObject(), true);
  assert.equal(sufficiency.state, "acquisition_running");
});

test("searched with zero results is a different state from never searched", () => {
  const { campaignObject: applied } = applyDiscoverySearchResultToCampaignObject({
    campaignObject: campaignObject(),
    creators: [],
    total: 0,
    facts: FACTS,
    now: NOW,
  });

  const data = applied.sections.creators.data as Record<string, unknown>;
  assert.equal(data.lastDiscoveryAt, NOW, "the search is recorded even with no results");

  const sufficiency = resolveStudioDiscoverySufficiency(applied, false);
  assert.equal(sufficiency.state, "no_inventory");
  assert.match(sufficiency.detail, /did not return creators/);
});

test("results move the stage off the ready state and record the pool", () => {
  const { campaignObject: applied, proposed } = applyDiscoverySearchResultToCampaignObject({
    campaignObject: campaignObject(),
    creators: [creator("a"), creator("b"), creator("c")],
    total: 3,
    facts: FACTS,
    cipProfileId: "cip-1",
    now: NOW,
  });

  const data = applied.sections.creators.data as Record<string, unknown>;
  assert.deepEqual((data.discovery as { creatorIds: string[] }).creatorIds, ["a", "b", "c"]);
  assert.equal((data.discovery as { total: number }).total, 3);
  assert.equal(data.discoveryEngine, "cip");
  assert.equal(data.cipProfileId, "cip-1");
  assert.equal(data.lastDiscoveryAt, NOW);
  assert.equal(typeof data.discoveryDisplay, "string");
  assert.ok(proposed || data.slateProposalStatus, "the existing proposal path ran");

  const sufficiency = resolveStudioDiscoverySufficiency(applied, false);
  assert.notEqual(sufficiency.state, "discovery_ready");
  assert.ok(sufficiency.inventoryCount >= 3);
});

test("an existing slate is not wiped by a re-run that returns nothing", () => {
  const withSlate = campaignObject({
    discovery: { creatorIds: ["a", "b"], total: 2 },
    recommendations: { creatorIds: ["a"], selectedReasoning: [] },
  });
  const { campaignObject: applied } = applyDiscoverySearchResultToCampaignObject({
    campaignObject: withSlate,
    creators: [],
    total: 0,
    facts: FACTS,
    now: NOW,
  });
  const data = applied.sections.creators.data as Record<string, unknown>;
  assert.deepEqual(
    (data.recommendations as { creatorIds: string[] }).creatorIds,
    ["a"],
    "a failed re-search must not delete the committed slate"
  );
});

// ---------------------------------------------------------------------------
// The action runs the production search, not a new one (Part 3/12).

test("the Run Discovery action calls the production Discovery search", () => {
  const source = readFileSync(
    "features/campaign-studio/actions/run-studio-discovery-action.ts",
    "utf8"
  );

  assert.match(
    source,
    /searchCreatorsFromProfileData/,
    "must call the same function executeSearchCreatorsProduction calls"
  );
  assert.match(source, /buildCreatorSearchRequirements/, "CSR is resolved before the search");
  assert.match(
    source,
    /applyDiscoverySearchResultToCampaignObject/,
    "results go through the shared section assembly"
  );
  // No second search implementation.
  assert.ok(
    !/browseUnifiedCreators\s*\(/.test(source),
    "the action must not browse creators itself"
  );
  assert.ok(
    !/composeCreatorSlate/.test(source),
    "slate composition stays in the existing proposal path"
  );
});
