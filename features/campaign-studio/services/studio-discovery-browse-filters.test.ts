/**
 * Replace → Browse Discovery.
 *
 * The Replace panel could only search Discovery by name or handle, so an
 * operator with no remaining recommended candidates had to already know who
 * they wanted. Browsing needs the campaign's own constraints, and these come
 * from the existing Creator Search Requirements projection — not a new filter
 * model.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { StudioDraftCreatorRef } from "@/features/campaign-intelligence/types/section-schemas";

import {
  buildCreatorSelectionChange,
  undoTargetIdForSelectionChange,
} from "./studio-creator-replacement";
import {
  hasStudioCampaignBrowseConstraints,
  studioCampaignBrowseFilters,
} from "./studio-discovery-browse-filters";

const NOW = "2026-04-01T00:00:00.000Z";

const FACTS: CampaignFacts = {
  brandName: "Kérastase",
  industry: "Beauty & Personal Care",
  objective: "Drive Consideration & Conversion",
  audience: "Women aged 20–40 in Egypt interested in premium haircare",
  geography: ["Egypt"],
  platforms: ["instagram", "tiktok"],
  creatorCategories: ["Beauty", "Fashion"],
  creatorTiers: [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }],
  budget: { amount: 3_000_000, currency: "EGP" },
  durationWeeks: 4,
  extractedAt: NOW,
  confidence: {},
  sources: { creatorTiers: "brief" },
};

function campaignObject(facts?: CampaignFacts): CampaignObject {
  const section = () => ({ status: "complete" as const, content: "", data: {} });
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      summary: section(),
      audience: section(),
      strategy: section(),
      creators: section(),
      budget: section(),
      timeline: section(),
      performance: section(),
      presentation: section(),
      operations: section(),
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      ...(facts ? { campaignFacts: facts } : {}),
    },
  } as unknown as CampaignObject;
}

test("browsing is filtered by the campaign's confirmed market and platforms", () => {
  const filters = studioCampaignBrowseFilters(campaignObject(FACTS));

  assert.equal(hasStudioCampaignBrowseConstraints(filters), true);
  const countries = [
    filters.country,
    ...(filters.creatorCountries ?? []),
    ...(filters.audienceCountries ?? []),
  ].filter(Boolean);
  assert.ok(
    countries.some((value) => String(value).toUpperCase() === "EG"),
    `expected Egypt in ${JSON.stringify(countries)}`
  );
  const platforms = [filters.platform, ...(filters.platforms ?? [])].filter(Boolean);
  assert.ok(
    platforms.some((value) => String(value).toLowerCase() === "instagram"),
    `expected instagram in ${JSON.stringify(platforms)}`
  );
  assert.equal(filters.productionOnly, true, "demo placeholders are never browsed");
});

test("browsing needs no query and no prior search", () => {
  const filters = studioCampaignBrowseFilters(campaignObject(FACTS));
  assert.equal(filters.search, undefined, "a name search is not required to browse");
  assert.equal(filters.page, 1);
  assert.ok((filters.pageSize ?? 0) > 0);
});

test("a campaign with no confirmed facts still browses, and says it is unfiltered", () => {
  const filters = studioCampaignBrowseFilters(campaignObject());
  assert.equal(hasStudioCampaignBrowseConstraints(filters), false);
  assert.equal(filters.productionOnly, true);
});

test("no campaign object at all is safe", () => {
  const filters = studioCampaignBrowseFilters(undefined);
  assert.equal(filters.page, 1);
  assert.equal(hasStudioCampaignBrowseConstraints(filters), false);
});

test("a browsed creator stages as a replacement, and Undo restores the original", () => {
  // What the panel does with a creator picked from Browse Discovery: the same
  // staging path as every other route.
  const browsed: StudioDraftCreatorRef = {
    creatorId: "inf:browsed-1",
    displayName: "Browsed Creator",
    handle: "browsed_1",
    platform: "instagram",
    source: "discovery",
    enrichmentStatus: "not_requested",
  };

  const change = buildCreatorSelectionChange({
    replacement: browsed,
    target: { creatorId: "inf:selected-a", displayName: "Creator A" },
    stagedAt: NOW,
  });

  assert.equal(change.kind, "replace_creator");
  assert.ok(change.kind === "replace_creator");
  assert.equal(change.replacement.creatorId, "inf:browsed-1");
  assert.equal(undoTargetIdForSelectionChange(change), "inf:selected-a");
});
