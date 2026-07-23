import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  buildQuotationSeedFromCreator,
  buildQuotationSeedFromShortlistItem,
  buildQuotationSeedsFromImportPlan,
  filterNewShortlistImportItems,
  planShortlistItemsForQuotationImport,
} from "@/features/quotations/shortlist-seeds";

function mockCreator(overrides?: Partial<UnifiedCreatorResult>): UnifiedCreatorResult {
  return {
    unified_id: "u-1",
    display_name: "Amir Hassan",
    influencer_id: "inf-1",
    discovered_profile_id: "prof-1",
    country_code: "EG",
    estimated_country: "EG",
    suggested_currency: "EGP",
    authenticity_score: 85,
    platforms: [
      {
        platform: "instagram",
        handle: "amir",
        follower_count: 120000,
        engagement_rate: 3.2,
      },
    ],
    metrics: {
      followers: { value: 120000, confidence: "verified" },
      engagement_rate: { value: 3.2, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    categories: [],
    ...overrides,
  } as UnifiedCreatorResult;
}

// Creator snapshot fields populate from unified browse result
{
  const seed = buildQuotationSeedFromCreator(mockCreator());
  assert.equal(seed.creator_name, "Amir Hassan");
  assert.equal(seed.platform, "instagram");
  assert.equal(seed.handle, "amir");
  assert.equal(seed.followers, 120000);
  assert.equal(seed.engagement_rate, 3.2);
  assert.equal(seed.country_code, "EG");
  assert.equal(seed.cost_currency, "EGP");
}

// Shortlist item merges commercial fields + creator snapshot
{
  const seed = buildQuotationSeedFromShortlistItem(
    {
      id: "item-1",
      influencer_id: "inf-1",
      profile_id: "prof-1",
      unified_id: "u-1",
      commercial_input_mode: "cost_gp_pct",
      cost: 5000,
      cost_currency: "USD",
      gp_pct: 20,
      revenue: null,
      gp_value: null,
      deliverables: [{ platform: "instagram", type: "reel", quantity: 1 }],
    },
    mockCreator()
  );
  assert.equal(seed.source_shortlist_item_id, "item-1");
  assert.equal(seed.creator_name, "Amir Hassan");
  assert.equal(seed.platform, "instagram");
  assert.equal(seed.cost, 5000);
  assert.equal(seed.cost_currency, "USD");
  assert.equal(seed.gp_pct, 20);
  assert.equal(seed.deliverables?.length, 1);
}

// Without resolved creator, IDs still carry through for insert
{
  const seed = buildQuotationSeedFromShortlistItem(
    {
      id: "item-2",
      influencer_id: "inf-2",
      profile_id: null,
      unified_id: "u-2",
    },
    null
  );
  assert.equal(seed.influencer_id, "inf-2");
  assert.equal(seed.unified_id, "u-2");
  assert.equal(seed.source_shortlist_item_id, "item-2");
  assert.equal(seed.creator_name, null);
}

// Import dedupe skips items already on quotation
{
  const items = [
    { id: "a", influencer_id: null, profile_id: null, unified_id: null },
    { id: "b", influencer_id: null, profile_id: null, unified_id: null },
    { id: "c", influencer_id: null, profile_id: null, unified_id: null },
  ];
  const pending = filterNewShortlistImportItems(items, ["a", "c"]);
  assert.deepEqual(
    pending.map((i) => i.id),
    ["b"]
  );
}

// Collap import keeps already-quoted creator as detached seat + imports full package
{
  let groupSeq = 0;
  const plan = planShortlistItemsForQuotationImport(
    [
      {
        id: "reem-sl",
        influencer_id: "inf-reem",
        profile_id: null,
        unified_id: "u-reem",
        collapse_group_id: "shortlist-collap-1",
        collapse_label: "Collap",
        cost: 130_000,
        deliverables: [{ platform: "instagram", type: "reel", quantity: 1 }],
      },
      {
        id: "seif-sl",
        influencer_id: "inf-seif",
        profile_id: null,
        unified_id: "u-seif",
        collapse_group_id: "shortlist-collap-1",
        collapse_label: "Collap",
      },
    ],
    ["reem-sl"],
    { newCollapseGroupId: () => `qt-collap-${++groupSeq}` }
  );

  assert.equal(plan.length, 2);
  assert.equal(plan[0]!.collapseGroupId, "qt-collap-1");
  assert.equal(plan[1]!.collapseGroupId, "qt-collap-1");

  const reem = plan.find((entry) => entry.item.id === "reem-sl")!;
  const seif = plan.find((entry) => entry.item.id === "seif-sl")!;
  assert.equal(reem.detachSourceLink, true);
  assert.equal(reem.identityOnly, true);
  assert.equal(seif.detachSourceLink, false);
  assert.equal(seif.identityOnly, false, "new member leads package pricing");

  const seeds = buildQuotationSeedsFromImportPlan(plan, new Map());
  const reemSeed = seeds.find((seed) => seed.unified_id === "u-reem")!;
  const seifSeed = seeds.find((seed) => seed.unified_id === "u-seif")!;
  assert.equal(reemSeed.source_shortlist_item_id, null);
  assert.equal(reemSeed.collapse_group_id, "qt-collap-1");
  assert.deepEqual(reemSeed.deliverables, []);
  assert.equal(reemSeed.cost, null);
  assert.equal(seifSeed.source_shortlist_item_id, "seif-sl");
  assert.equal(seifSeed.collapse_group_id, "qt-collap-1");
}

// Standalone already on quotation is still skipped; collap-only selection still imports
{
  const plan = planShortlistItemsForQuotationImport(
    [
      {
        id: "solo",
        influencer_id: null,
        profile_id: null,
        unified_id: "u-solo",
      },
      {
        id: "a",
        influencer_id: null,
        profile_id: null,
        unified_id: "u-a",
        collapse_group_id: "g1",
        collapse_label: "Collap",
      },
      {
        id: "b",
        influencer_id: null,
        profile_id: null,
        unified_id: "u-b",
        collapse_group_id: "g1",
        collapse_label: "Collap",
      },
    ],
    ["solo", "a", "b"],
    { newCollapseGroupId: () => "fresh-g1" }
  );
  assert.deepEqual(
    plan.map((entry) => entry.item.id).sort(),
    ["a", "b"]
  );
  assert.ok(plan.every((entry) => entry.detachSourceLink));
}

// Multi-platform creator seeds null line platform + metrics-account handle
{
  const seed = buildQuotationSeedFromCreator(
    mockCreator({
      default_metrics_platform_account_id: "tt-1",
      platforms: [
        {
          id: "ig-1",
          platform: "instagram",
          handle: "amir",
          profile_url: null,
          follower_count: 120000,
          engagement_rate: 3.2,
          audience_country: "EG",
        },
        {
          id: "tt-1",
          platform: "tiktok",
          handle: "amir.tt",
          profile_url: null,
          follower_count: 500000,
          engagement_rate: 5.1,
          audience_country: "EG",
        },
      ],
      metrics: {
        followers: { value: 500000, confidence: "verified" },
        engagement_rate: { value: 5.1, confidence: "verified" },
        avg_likes: { value: null, confidence: "estimated" },
        avg_comments: { value: null, confidence: "estimated" },
        avg_views: { value: null, confidence: "estimated" },
        posting_frequency_per_week: { value: null, confidence: "estimated" },
      },
    })
  );
  assert.equal(seed.platform, null);
  assert.equal(seed.handle, "amir.tt");
  assert.equal(seed.followers, 500000);
  assert.equal(seed.engagement_rate, 5.1);
}

{
  const seed = buildQuotationSeedFromCreator(
    mockCreator({
      default_metrics_platform_account_id: "tt-1",
      platforms: [
        {
          id: "tt-1",
          platform: "tiktok",
          handle: "karimgaadd",
          profile_url: null,
          follower_count: 58_500,
          engagement_rate: 3.14,
          audience_country: "EG",
        },
      ],
      metrics: {
        followers: { value: 0, confidence: "verified" },
        engagement_rate: { value: 3.14, confidence: "verified" },
        avg_likes: { value: null, confidence: "estimated" },
        avg_comments: { value: null, confidence: "estimated" },
        avg_views: { value: null, confidence: "estimated" },
        posting_frequency_per_week: { value: null, confidence: "estimated" },
      },
    })
  );
  assert.equal(seed.followers, 58_500, "seed uses platform followers when DNA metrics are zero");
}

console.log("shortlist-seeds.test.ts: all assertions passed");
