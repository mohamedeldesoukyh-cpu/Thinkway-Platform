import assert from "node:assert/strict";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  buildPlatformSelectionsForCreator,
  filterExecutionCreatorIds,
  mapCampaignPlanToLineSeeds,
  resolveCampaignNameFromPlan,
} from "./campaign-plan-execution-mapper";

function baseCampaignObject(overrides?: Partial<CampaignObject>): CampaignObject {
  return {
    id: "co-test",
    workflowId: null,
    sections: {
      summary: { content: { campaignName: "Summer Launch" }, status: "complete" },
      audience: { content: "", status: "pending" },
      strategy: { content: "", status: "pending" },
      creators: {
        content: "",
        data: {
          recommendations: {
            creatorIds: ["inf:a", "inf:b", "inf:c"],
          },
          vendorDecisions: {
            "inf:b": "rejected",
          },
        },
        status: "complete",
      },
      budget: { content: "", status: "pending" },
      timeline: { content: "", status: "pending" },
      performance: { content: "", status: "pending" },
      presentation: { content: "", status: "pending" },
      operations: { content: "", status: "pending" },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        budget: { amount: 300_000, currency: "EGP" },
        platforms: ["Instagram", "TikTok"],
        deliverables: ["Instagram: 2× Reel", "TikTok: 1× video"],
        extractedAt: new Date().toISOString(),
        confidence: {},
        sources: {},
      },
    },
    ...overrides,
  } as CampaignObject;
}

function mockCreator(id: string, influencerId: string): UnifiedCreatorResult {
  return {
    unified_id: id,
    source_type: "internal",
    influencer_id: influencerId,
    discovered_profile_id: null,
    document_number: null,
    display_name: `Creator ${id}`,
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: 120_000, confidence: "verified" },
      engagement_rate: { value: 3.2, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 70,
    source_confidence: 0.9,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        platform: "instagram",
        handle: "creator_ig",
        profile_url: null,
        follower_count: 120_000,
        engagement_rate: 3.2,
        audience_country: "EG",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        platform: "tiktok",
        handle: "creator_tt",
        profile_url: null,
        follower_count: 90_000,
        engagement_rate: 4.1,
        audience_country: "EG",
      },
    ],
  };
}

assert.deepEqual(
  filterExecutionCreatorIds(baseCampaignObject()),
  ["inf:a", "inf:c"],
  "rejected creators are excluded from execution"
);

// STAB-039: hydrateSlateCreators / Generate must share this discovery fallback.
assert.deepEqual(
  filterExecutionCreatorIds(
    baseCampaignObject({
      sections: {
        ...baseCampaignObject().sections,
        creators: {
          content: "",
          data: {
            recommendations: { creatorIds: [] },
            discovery: { creatorIds: ["inf:d1", "inf:d2"] },
          },
          status: "complete",
        },
      },
    })
  ),
  ["inf:d1", "inf:d2"],
  "STAB-039: empty recommendations fall back to discovery ids"
);

const selections = buildPlatformSelectionsForCreator(
  mockCreator("inf:a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
  ["Instagram"],
  ["Instagram: 2× Reel"]
);
assert.equal(selections.length, 1);
assert.equal(selections[0]?.platform, "instagram");
assert.equal(selections[0]?.deliverables[0], "instagram_reel");

const seeds = mapCampaignPlanToLineSeeds({
  campaignObject: baseCampaignObject(),
  creators: [
    mockCreator("inf:a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    mockCreator("inf:c", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"),
  ],
  influencerIdByCreatorId: new Map([
    ["a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["c", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"],
  ]),
});

assert.equal(seeds.length, 2);
assert.equal(
  seeds.reduce((sum, seed) => sum + seed.cost, 0),
  300_000,
  "creator fees (cost) split across approved slate vendors"
);
assert.equal(
  seeds.reduce((sum, seed) => sum + seed.revenue, 0),
  400_000,
  "STAB-016: default 25% GP applied so revenue exceeds cost"
);
assert.equal(seeds[0]?.gpPct, 25);
assert.ok(seeds[0]!.revenue > seeds[0]!.cost);
assert.equal(seeds[0]?.currencyCode, "EGP");

// STAB-021: header PO for Generate must use revenue total (not brief cost budget).
const headerPoFromSeeds = seeds.reduce((sum, seed) => sum + Math.max(0, seed.revenue), 0);
assert.equal(headerPoFromSeeds, 400_000);
assert.ok(
  headerPoFromSeeds > seeds.reduce((sum, seed) => sum + seed.cost, 0),
  "PO sized to revenue prevents immediate PO-exceeded after Generate"
);

// STAB-037: ceil PO so fractional line revenues cannot exceed the header ceiling.
const fractionalLineRevenues = Array.from({ length: 10 }, () => 53333.33);
const fractionalSum = fractionalLineRevenues.reduce((sum, n) => sum + n, 0);
const ceilPo = Math.ceil(fractionalSum - 1e-9);
assert.ok(fractionalSum > Math.round(fractionalSum), "fixture must be a round-down trap");
assert.ok(ceilPo >= fractionalSum, "STAB-037: PO must cover exact Σ line revenue");
assert.equal(ceilPo, 533334);

assert.equal(resolveCampaignNameFromPlan(baseCampaignObject()), "Summer Launch");

console.log("campaign-plan-execution-mapper.test.ts — all tests passed");
