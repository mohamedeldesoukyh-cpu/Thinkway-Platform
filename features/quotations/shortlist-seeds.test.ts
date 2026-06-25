import assert from "node:assert/strict";

import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  buildQuotationSeedFromCreator,
  buildQuotationSeedFromShortlistItem,
  filterNewShortlistImportItems,
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

console.log("shortlist-seeds.test.ts: all assertions passed");
