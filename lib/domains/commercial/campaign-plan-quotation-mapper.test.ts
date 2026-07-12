import assert from "node:assert/strict";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { normalizeCreatorScheduleKey } from "./campaign-plan-tentative-schedule";

import {
  mapCampaignPlanToQuotationHeaderSeed,
  mapCampaignPlanToQuotationItemSeeds,
} from "./campaign-plan-quotation-mapper";

function baseCampaignObject(overrides?: Partial<CampaignObject>): CampaignObject {
  return {
    id: "co-test",
    workflowId: null,
    sections: {
      summary: { content: { campaignName: "Summer Launch" }, status: "complete" },
      audience: { content: "", status: "pending" },
      strategy: {
        content: "",
        data: {
          groundedFields: [
            { label: "Key Message", value: "Refresh your summer routine" },
            { label: "Creator Strategy", value: "Macro + micro mix" },
          ],
          creativeConcepts: [
            {
              name: "Glow Up",
              bigIdea: "",
              hook: "",
              keyVisual: "",
              contentTheme: "Morning rituals",
              cta: "",
              sampleCaption: "",
              hashtags: [],
            },
          ],
        },
        status: "complete",
      },
      creators: {
        content: "",
        data: {
          recommendations: {
            creatorIds: ["inf:a", "inf:b"],
            selectedReasoning: [
              {
                creatorId: "inf:a",
                displayName: "Alpha Creator",
                whySelected: "",
                expectedRole: "Macro lead",
                audienceMatch: "",
                risk: "Low brand risk",
                alternative: "",
                contribution: "Hero content",
                confidence: 0.9,
                evidence: "",
                tradeoff: "",
                directorNotes: "Priority creator for launch week",
              },
            ],
          },
          vendorDecisions: {
            "inf:b": "rejected",
          },
        },
        status: "complete",
      },
      budget: { content: "", status: "pending" },
      timeline: {
        content: {
          durationWeeks: 4,
          milestones: [],
          goLiveWeek: 1,
        },
        status: "complete",
      },
      performance: { content: "", status: "pending" },
      presentation: { content: "", status: "pending" },
      operations: {
        content: "Internal QA checklist before publish",
        data: {
          enrichedRisks: [
            {
              risk: "Late asset delivery",
              severity: "medium",
              probability: "medium",
              impact: "Schedule slip",
              mitigation: "Lock concepts 7 days before publish",
              owner: "Campaign Manager",
              status: "Monitoring",
            },
          ],
        },
        status: "complete",
      },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        budget: { amount: 200_000, currency: "EGP" },
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

const header = mapCampaignPlanToQuotationHeaderSeed(baseCampaignObject());
assert.equal(header.name, "Quotation — Summer Launch");
assert.ok(header.notes?.includes("Key message: Refresh your summer routine"));
assert.ok(header.notes?.includes("Content pillars"));
assert.ok(header.notes?.includes("Morning rituals"));
assert.ok(header.notes?.includes("Special requirements"));
assert.ok(header.notes?.includes("Internal notes"));
assert.ok(header.notes?.includes("Priority creator for launch week"));

const seeds = mapCampaignPlanToQuotationItemSeeds({
  campaignObject: baseCampaignObject(),
  creators: [
    mockCreator("inf:a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
    mockCreator("inf:b", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
  ],
  influencerIdByCreatorId: new Map([
    ["a", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
  ]),
  issueDate: "2026-08-01",
  anchorStartDate: "2026-07-06",
});

assert.equal(seeds.length, 1, "rejected creator excluded");
assert.equal(seeds[0]?.cost, 200_000, "creator fees allocated to approved vendor");
assert.equal(seeds[0]?.service_description, "Role: Macro lead · Contribution: Hero content · Risk: Low brand risk");
assert.ok((seeds[0]?.deliverables?.length ?? 0) >= 1);

const reelLine = seeds[0]?.deliverables?.find((d) => d.type === "instagram_reel");
assert.ok(reelLine);
assert.equal(reelLine?.type_lines?.[0]?.quantity, 2, "parses quantity from facts deliverables");

const scheduleKey = normalizeCreatorScheduleKey("inf:a");
const deliverableWithSchedule = seeds[0]?.deliverables?.find(
  (d) => d.tentative_posting_label || d.schedule_source === "campaign_plan"
);
if (deliverableWithSchedule) {
  assert.equal(deliverableWithSchedule.schedule_source, "campaign_plan");
}

console.log("campaign-plan-quotation-mapper.test.ts — all tests passed");
