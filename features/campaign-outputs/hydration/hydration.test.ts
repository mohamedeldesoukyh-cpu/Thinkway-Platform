import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";
import type { ShortlistDetail } from "@/features/discovery/shortlists/types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import { inferTier, seedFromQuotation, seedFromShortlist, seedFromDiscovery } from "./seed-adapters";
import { hydrateCampaignObject, emptyCampaignObject } from "./hydrate";
import { detectMissingInformation, readinessForOutput } from "./missing-info";
import { resolveSlate } from "../output-inputs";
import { listCampaignOutputs } from "../output-registry";

// --- Minimal fixtures (only the fields the adapters read) ----------------------

function quotationFixture(): QuotationDetail {
  return {
    id: "q1",
    name: "Summer Quote",
    campaign_name: "Summer Launch",
    client_name: "Acme Co",
    brand_name: "Acme",
    currency: "EGP",
    total_revenue_egp: 2_000_000,
    estimated_reach: 8_000_000,
    estimated_engagement_rate: 4,
    items: [
      {
        id: "i1",
        unified_id: "cr_1",
        creator_name: "Nour Star",
        platform: "Instagram",
        followers: 1_500_000,
        engagement_rate: 3.2,
        country_code: "EG",
        creator_categories: ["beauty"],
        deliverables: [
          {
            platform: "Instagram",
            type: "instagram_reel",
            quantity: 2,
            type_lines: [
              { type: "instagram_reel", quantity: 1 },
              { type: "ig_story_set", quantity: 1 },
              { type: "mirrored_ig", quantity: 1 },
            ],
          },
        ],
        service_description: "2 Reels",
        profile_image_url: "https://cdn.example/avatar1.jpg",
        profile_url: "https://instagram.com/nour",
      },
      {
        id: "i2",
        unified_id: "cr_2",
        creator_name: "Sara Micro",
        platform: "TikTok",
        followers: 40_000,
        engagement_rate: 6.1,
        country_code: "EG",
        creator_categories: ["lifestyle"],
        deliverables: [],
        service_description: "3 TikToks",
      },
    ],
  } as unknown as QuotationDetail;
}

function unifiedCreator(id: string, name: string, followers: number, role?: string): UnifiedCreatorResult {
  return {
    unified_id: id,
    display_name: name,
    role: role ?? null,
    country_code: "EG",
    categories: ["beauty"],
    audience_interests: ["skincare", "makeup"],
    brand_fit_score: 82,
    thinkway_score: 75,
    metrics: { followers: { value: followers }, engagement_rate: { value: 4 } },
    platforms: [{ platform: "Instagram", follower_count: followers, engagement_rate: 4 }],
  } as unknown as UnifiedCreatorResult;
}

function shortlistFixture(): ShortlistDetail {
  return {
    id: "s1",
    name: "Beauty Shortlist",
    client_name: "Acme Co",
    brand_name: "Acme",
    creators: [
      { creator: unifiedCreator("cr_1", "Nour Star", 1_500_000, "Celebrity") },
      { creator: unifiedCreator("cr_3", "Layla Macro", 600_000) },
    ],
  } as unknown as ShortlistDetail;
}

// --- Tier inference ------------------------------------------------------------

test("tier inference maps follower counts to tiers via platform SSOT", () => {
  assert.equal(inferTier(5_000_000), "Celebrity");
  assert.equal(inferTier(2_000_000), "Mega");
  assert.equal(inferTier(1_000_000), "Mega");
  assert.equal(inferTier(600_000), "Macro");
  assert.equal(inferTier(150_000), "Mid");
  assert.equal(inferTier(40_000), "Micro");
  assert.equal(inferTier(5_000), "Nano");
  assert.equal(inferTier(0), undefined);
});

// --- Quotation hydration -------------------------------------------------------

test("quotation hydrates client, budget, platforms, deliverables, and creators", () => {
  const seed = seedFromQuotation(quotationFixture());
  assert.equal(seed.client, "Acme Co");
  assert.deepEqual(seed.budget, { amount: 2_000_000, currency: "EGP" });
  assert.deepEqual(new Set(seed.platforms), new Set(["Instagram", "TikTok"]));
  assert.ok(seed.deliverables && seed.deliverables.length > 0);
  assert.equal(seed.creators.length, 2);
  assert.equal(seed.creators[0]!.tier, "Mega"); // inferred from 1.5M followers

  const { campaignObject, missing } = hydrateCampaignObject(seed);
  assert.equal(resolveSlate(campaignObject).length, 2);
  // Objective and duration are not in a quotation → flagged missing.
  assert.ok(missing.missingLabels.includes("Campaign objective"));
  assert.ok(missing.missingLabels.includes("Campaign duration"));
  assert.ok(!missing.missingLabels.includes("Budget"));
  assert.ok(!missing.missingLabels.includes("Creators"));
});

test("quotation seed carries ad types and avatars; re-hydrate syncs them onto slate", () => {
  const seed = seedFromQuotation(quotationFixture());
  assert.equal(seed.creators[0]!.serviceLabel, "1× IG Reel · 1× IG Set of stories · 1× Mirrored IG");
  assert.deepEqual(seed.creators[0]!.serviceTypes, [
    "1× IG Reel",
    "1× IG Set of stories",
    "1× Mirrored IG",
  ]);
  assert.equal(seed.creators[0]!.avatarUrl, "https://cdn.example/avatar1.jpg");

  const first = hydrateCampaignObject(seed);
  const second = hydrateCampaignObject(seed, first.campaignObject);
  const nour = resolveSlate(second.campaignObject).find((c) => c.creatorId === "cr_1");
  assert.equal(nour?.serviceLabel, "1× IG Reel · 1× IG Set of stories · 1× Mirrored IG");
  assert.deepEqual(nour?.serviceTypes, ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"]);
  assert.equal(nour?.avatarUrl, "https://cdn.example/avatar1.jpg");
});

// --- Shortlist / Discovery hydration ------------------------------------------

test("shortlist hydration carries creators, platforms, audience; role wins over inference", () => {
  const seed = seedFromShortlist(shortlistFixture());
  assert.equal(seed.creators.length, 2);
  assert.equal(seed.creators[0]!.tier, "Celebrity"); // explicit role
  assert.equal(seed.creators[1]!.tier, "Macro"); // inferred from 600k
  assert.ok(seed.audience && /skincare/.test(seed.audience));

  const { missing } = hydrateCampaignObject(seed);
  assert.ok(!missing.missingLabels.includes("Creators"));
  assert.ok(missing.missingLabels.includes("Budget")); // shortlist has no budget
});

test("discovery selection hydrates a creator slate", () => {
  const seed = seedFromDiscovery([unifiedCreator("cr_1", "A", 1_200_000, "Celebrity")]);
  assert.equal(seed.source, "discovery_selection");
  assert.equal(seed.creators.length, 1);
});

// --- Never overwrite validated information ------------------------------------

test("hydration fills gaps but never overwrites validated facts or a non-empty slate", () => {
  const existing = emptyCampaignObject();
  existing.meta.campaignFacts = {
    clientName: "Validated Client",
    objective: "Validated objective",
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };

  const seed = seedFromQuotation(quotationFixture()); // has client "Acme Co", budget, creators
  const { campaignObject, hydratedFields, preservedFields } = hydrateCampaignObject(seed, existing);

  // Existing validated client + objective preserved; budget filled from the seed.
  assert.equal(campaignObject.meta.campaignFacts?.clientName, "Validated Client");
  assert.equal(campaignObject.meta.campaignFacts?.objective, "Validated objective");
  assert.deepEqual(campaignObject.meta.campaignFacts?.budget, { amount: 2_000_000, currency: "EGP" });
  assert.ok(preservedFields.includes("client"));
  assert.ok(hydratedFields.includes("budget"));
});

// --- Generate from anywhere ----------------------------------------------------

test("readinessForOutput reports which outputs a hydrated source can generate", () => {
  const { campaignObject } = hydrateCampaignObject(seedFromQuotation(quotationFixture()));
  // Media Plan needs creators/platforms/timeline/deliverables_scope — timeline missing.
  const media = readinessForOutput(campaignObject, "media_plan");
  assert.equal(media.ready, false);
  assert.ok(media.missingInputs.includes("Timeline"));

  // Budget Allocation needs budget/creators/platforms — all present from the quote.
  const budget = readinessForOutput(campaignObject, "budget_allocation");
  assert.equal(budget.ready, true);
  assert.deepEqual(budget.missingInputs, []);
});

test("hydrated Campaign Object is a valid input to the Outputs Engine", () => {
  const { campaignObject } = hydrateCampaignObject(seedFromShortlist(shortlistFixture()));
  const views = listCampaignOutputs(campaignObject);
  assert.ok(views.length > 0);
  assert.ok(views.every((v) => v.status === "not_generated"));
});

test("empty campaign object reports everything missing", () => {
  const missing = detectMissingInformation(emptyCampaignObject());
  assert.equal(missing.known.length, 0);
  assert.ok(missing.missing.length >= 10);
});
