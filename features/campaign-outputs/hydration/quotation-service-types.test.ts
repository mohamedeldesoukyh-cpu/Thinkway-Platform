import { strict as assert } from "node:assert";
import { test } from "node:test";

import type { QuotationDetail } from "@/lib/domains/commercial/quotation-detail-types";

import { seedFromQuotation } from "./seed-adapters";
import { parseAggregatedServiceLabel } from "./quotation-service-types";
import { hydrateCampaignObject } from "./hydrate";
import { resolveSlate } from "../output-inputs";
import { generateMediaPlan, type MediaPlanData } from "../generators/media-plan";

test("parseAggregatedServiceLabel splits quotation plus-separated summaries", () => {
  assert.deepEqual(
    parseAggregatedServiceLabel("1× TT Video + 1× TikTok Story + 1× Mirrored FB + 1× Mirrored IG"),
    ["1× TT Video", "1× TikTok Story", "1× Mirrored FB", "1× Mirrored IG"]
  );
});

test("quotation item with four type lines expands to four media plan slots", () => {
  const quotation = {
    id: "q1",
    name: "Coach campaign",
    currency: "EGP",
    total_revenue_egp: 26_000,
    items: [
      {
        id: "i1",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        handle: "@coach_ghofran",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 26_000,
        deliverables: [
          {
            platform: "TikTok",
            type_lines: [
              { type: "tiktok_video", quantity: 1 },
              { type: "tiktok_story", quantity: 1 },
              { type: "mirrored_fb", quantity: 1 },
              { type: "mirrored_ig", quantity: 1 },
            ],
          },
        ],
      },
    ],
  } as unknown as QuotationDetail;

  const seed = seedFromQuotation(quotation);
  assert.deepEqual(seed.creators[0]!.serviceTypes, [
    "1× TT Video",
    "1× TikTok Story",
    "1× Mirrored FB",
    "1× Mirrored IG",
  ]);

  const { campaignObject } = hydrateCampaignObject(seed);
  const data = generateMediaPlan(campaignObject).data as MediaPlanData;
  const coachSlots = data.weeks.flatMap((week) =>
    week.days.flatMap((day) => {
      const slots: Array<{ serviceType?: string }> = [];
      if (day.creator?.includes("Coach Ghofran")) {
        slots.push({ serviceType: day.serviceType });
      }
      return slots;
    })
  );

  assert.equal(coachSlots.length, 4);
  assert.deepEqual(
    coachSlots.map((slot) => slot.serviceType).sort(),
    ["1× Mirrored FB", "1× Mirrored IG", "1× TT Video", "1× TikTok Story"].sort()
  );
  assert.equal(data.postingSlotCount, 4);
  assert.equal(
    Object.values(data.platformAllocation).reduce((sum, count) => sum + count, 0),
    4
  );
});

test("quotation re-hydrate replaces stale slate with per-line ad types", () => {
  const quotation = {
    id: "q1",
    name: "Coach campaign",
    currency: "EGP",
    total_revenue_egp: 26_000,
    items: [
      {
        id: "i1",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        handle: "@coach_ghofran",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 26_000,
        deliverables: [
          {
            type_lines: [
              { type: "tiktok_video", quantity: 1 },
              { type: "tiktok_story", quantity: 1 },
              { type: "mirrored_fb", quantity: 1 },
              { type: "mirrored_ig", quantity: 1 },
            ],
          },
        ],
      },
    ],
  } as unknown as QuotationDetail;

  const seed = seedFromQuotation(quotation);
  const stale = hydrateCampaignObject(
    { source: "discovery_selection", creators: [{ creatorId: "old_id", displayName: "Coach Ghofran foad (@coach_ghofran)", tier: "Macro" }] },
    undefined
  ).campaignObject;

  const refreshed = hydrateCampaignObject(seed, stale).campaignObject;
  const slate = resolveSlate(refreshed);
  assert.equal(slate.length, 1);
  assert.deepEqual(slate[0]!.serviceTypes, [
    "1× TT Video",
    "1× TikTok Story",
    "1× Mirrored FB",
    "1× Mirrored IG",
  ]);
});

test("types array expands when type_lines only has the total-cell primary type", () => {
  const quotation = {
    id: "q1",
    name: "Coach campaign",
    currency: "EGP",
    total_revenue_egp: 26_000,
    items: [
      {
        id: "i1",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 26_000,
        deliverables: [
          {
            type: "tiktok_video",
            types: ["tiktok_video", "tiktok_story", "mirrored_fb", "mirrored_ig"],
            type_lines: [{ type: "tiktok_video", quantity: 1 }],
          },
        ],
      },
    ],
  } as unknown as QuotationDetail;

  const seed = seedFromQuotation(quotation);
  assert.deepEqual(seed.creators[0]!.serviceTypes, [
    "1× TT Video",
    "1× TikTok Story",
    "1× Mirrored FB",
    "1× Mirrored IG",
  ]);

  const { campaignObject } = hydrateCampaignObject(seed);
  const data = generateMediaPlan(campaignObject).data as MediaPlanData;
  const coachDays = data.weeks
    .flatMap((week) => week.days)
    .filter((day) => day.creator?.includes("Coach Ghofran"));

  const scheduledTypes = coachDays.flatMap((day) => day.serviceTypes ?? []);
  assert.deepEqual(
    [...new Set(scheduledTypes)].sort(),
    ["1× Mirrored FB", "1× Mirrored IG", "1× TT Video", "1× TikTok Story"].sort()
  );
});

test("multiple quotation items for one creator merge all child ad types", () => {
  const quotation = {
    id: "q1",
    name: "Coach campaign",
    currency: "EGP",
    total_revenue_egp: 26_000,
    items: [
      {
        id: "i1",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 6_500,
        option_number: 1,
        deliverables: [
          { type: "tiktok_video", type_lines: [{ type: "tiktok_video", quantity: 1 }] },
        ],
      },
      {
        id: "i2",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 6_500,
        option_number: 1,
        deliverables: [
          { type: "tiktok_story", type_lines: [{ type: "tiktok_story", quantity: 1 }] },
        ],
      },
      {
        id: "i3",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 6_500,
        option_number: 1,
        deliverables: [
          { type: "mirrored_fb", type_lines: [{ type: "mirrored_fb", quantity: 1 }] },
        ],
      },
      {
        id: "i4",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 6_500,
        option_number: 1,
        deliverables: [
          { type: "mirrored_ig", type_lines: [{ type: "mirrored_ig", quantity: 1 }] },
        ],
      },
    ],
  } as unknown as QuotationDetail;

  const seed = seedFromQuotation(quotation);
  assert.equal(seed.creators.length, 1);
  assert.deepEqual(seed.creators[0]!.serviceTypes, [
    "1× TT Video",
    "1× TikTok Story",
    "1× Mirrored FB",
    "1× Mirrored IG",
  ]);

  const { campaignObject } = hydrateCampaignObject(seed);
  const slate = resolveSlate(campaignObject);
  assert.equal(slate.length, 1);
  assert.deepEqual(slate[0]!.serviceTypes, seed.creators[0]!.serviceTypes);
});

test("quotation commercials meta supplies slate types when reasoning lacks them", () => {
  const quotation = {
    id: "q1",
    name: "Coach campaign",
    currency: "EGP",
    total_revenue_egp: 26_000,
    items: [
      {
        id: "i1",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        handle: "@coach_ghofran",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 26_000,
        profile_image_url: "https://cdn.example/coach.jpg",
        profile_url: "https://tiktok.com/@coach_ghofran",
        deliverables: [
          { type: "tiktok_video", type_lines: [{ type: "tiktok_video", quantity: 1 }] },
          { type: "tiktok_story", type_lines: [{ type: "tiktok_story", quantity: 1 }] },
          { type: "mirrored_fb", type_lines: [{ type: "mirrored_fb", quantity: 1 }] },
          { type: "mirrored_ig", type_lines: [{ type: "mirrored_ig", quantity: 1 }] },
        ],
      },
    ],
  } as unknown as import("@/lib/domains/commercial/quotation-detail-types").QuotationDetail;

  const seed = seedFromQuotation(quotation);
  const { campaignObject } = hydrateCampaignObject(seed, undefined, { quotationId: "q1" });

  // Simulate Copilot overwriting reasoning without commercial fields.
  const stripped: typeof campaignObject = {
    ...campaignObject,
    sections: {
      ...campaignObject.sections,
      creators: {
        content: "",
        status: "complete",
        data: {
          recommendations: {
            creatorIds: ["coach_1"],
            selectedReasoning: [
              {
                creatorId: "coach_1",
                displayName: "@coach_ghofran",
                whySelected: "Discovery",
                expectedRole: "Macro",
                audienceMatch: "",
                risk: "",
                alternative: "",
                confidence: 0.5,
                evidence: "",
                tradeoff: "",
              },
            ],
          },
        },
      },
    },
  };

  const slate = resolveSlate(stripped);
  assert.equal(slate.length, 1);
  assert.deepEqual(slate[0]!.serviceTypes, [
    "1× TT Video",
    "1× TikTok Story",
    "1× Mirrored FB",
    "1× Mirrored IG",
  ]);
  assert.equal(slate[0]!.avatarUrl, "https://cdn.example/coach.jpg");

  const data = generateMediaPlan(stripped).data as MediaPlanData;
  const coachDays = data.weeks
    .flatMap((week) => week.days)
    .filter((day) => day.handle === "@coach_ghofran" || day.creator?.includes("Coach"));
  assert.ok(coachDays.length >= 1);
  const scheduledTypes = coachDays.flatMap((day) => day.serviceTypes ?? []);
  assert.deepEqual(
    [...new Set(scheduledTypes)].sort(),
    slate[0]!.serviceTypes!.slice().sort()
  );
  assert.equal(coachDays[0]!.avatarUrl, "https://cdn.example/coach.jpg");
});

test("multiple pricing rows each contribute one ad type to the creator card", () => {
  const quotation = {
    id: "q1",
    name: "Coach campaign",
    currency: "EGP",
    total_revenue_egp: 26_000,
    items: [
      {
        id: "i1",
        unified_id: "coach_1",
        creator_name: "Coach Ghofran foad",
        platform: "TikTok",
        followers: 542_000,
        revenue_egp: 26_000,
        deliverables: [
          { type: "tiktok_video", type_lines: [{ type: "tiktok_video", quantity: 1 }] },
          { type: "tiktok_story", type_lines: [{ type: "tiktok_story", quantity: 1 }] },
          { type: "mirrored_fb", type_lines: [{ type: "mirrored_fb", quantity: 1 }] },
          { type: "mirrored_ig", type_lines: [{ type: "mirrored_ig", quantity: 1 }] },
        ],
      },
    ],
  } as unknown as QuotationDetail;

  const seed = seedFromQuotation(quotation);
  assert.deepEqual(seed.creators[0]!.serviceTypes, [
    "1× TT Video",
    "1× TikTok Story",
    "1× Mirrored FB",
    "1× Mirrored IG",
  ]);
});
