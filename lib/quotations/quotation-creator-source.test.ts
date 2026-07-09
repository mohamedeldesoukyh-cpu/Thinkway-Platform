import assert from "node:assert/strict";

import type { CreatorProfileSource } from "@/lib/creators/creator-profile-source";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  buildQuotationCreatorProfileSource,
  mergeQuotationItemIntoProfileSource,
  resolveQuotationCreatorProfileSource,
} from "@/lib/quotations/quotation-creator-source";

function mockItem(overrides?: Partial<QuotationItemRow>): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: "inf-1",
    profile_id: null,
    unified_id: "inf:inf-1",
    source_shortlist_item_id: null,
    creator_name: "Amir Hassan",
    platform: null,
    handle: "amir.tt",
    followers: 500000,
    engagement_rate: 5.1,
    country_code: "EG",
    deliverables: [],
    profile_image_url: "https://cdn.example/avatar.jpg",
    profile_url: "https://tiktok.com/@amir.tt",
    option_number: 1,
    service_description: null,
    commercial_input_mode: "cost_gp_pct",
    cost: 0,
    cost_currency: "EGP",
    revenue: 0,
    gp_pct: 0,
    gp_value: 0,
    fx_rate_to_egp: 1,
    cost_egp: 0,
    revenue_egp: 0,
    gp_value_egp: 0,
    af_pct: 0,
    af_value: 0,
    af_value_egp: 0,
    sort_order: 0,
    ...overrides,
  };
}

// Multi-platform line snapshot keeps handle + profile URL without line platform
{
  const source = buildQuotationCreatorProfileSource(mockItem());
  assert.equal(source.handle, "amir.tt");
  assert.equal(source.profile_url, "https://tiktok.com/@amir.tt");
  assert.equal(source.countryCode, "EG");
}

// Enriched source wins for display name, verified, and country; item fills gaps
{
  const enriched: CreatorProfileSource = {
    displayName: "Amir Hassan (DNA)",
    handle: "amir",
    isVerified: true,
    countryCode: "AE",
    profile_url: "https://instagram.com/amir",
    linkedPlatforms: ["instagram", "tiktok"],
  };
  const merged = mergeQuotationItemIntoProfileSource(
    enriched,
    mockItem({ creator_name: "stale-handle", country_code: "Egypt" })
  );
  assert.equal(merged.displayName, "Amir Hassan (DNA)");
  assert.equal(merged.isVerified, true);
  assert.equal(merged.countryCode, "AE");
  assert.equal(merged.handle, "amir");
}

// Invalid stored country must not override valid enriched ISO code
{
  const enriched: CreatorProfileSource = {
    displayName: "Creator",
    countryCode: "EG",
  };
  const merged = mergeQuotationItemIntoProfileSource(
    enriched,
    mockItem({ country_code: "Egypt" })
  );
  assert.equal(merged.countryCode, "EG");
}

// Multi-platform linkage clears single platform but keeps identity details
{
  const source = resolveQuotationCreatorProfileSource(
    mockItem({
      creator_profile_source: {
        displayName: "Amir Hassan",
        handle: "amir.tt",
        isVerified: true,
        countryCode: "EG",
        profile_url: "https://tiktok.com/@amir.tt",
        linkedPlatforms: ["instagram", "tiktok"],
      },
    }),
    ["instagram", "tiktok"]
  );
  assert.equal(source.platform, null);
  assert.deepEqual(source.linkedPlatforms, ["instagram", "tiktok"]);
  assert.equal(source.isVerified, true);
  assert.equal(source.handle, "amir.tt");
}

console.log("quotation-creator-source.test.ts: all assertions passed");
