import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeQuotationItemIntoProfileSource, buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

function item(overrides: Partial<QuotationItemRow> = {}): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: "inf-1",
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator",
    platform: "instagram",
    handle: "creator",
    followers: null,
    engagement_rate: null,
    country_code: null,
    deliverables: [],
    profile_image_url: null,
    profile_url: null,
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

const dnaAvatar =
  "https://example.supabase.co/storage/v1/object/public/creator-avatars/stable.jpg";
const expiredCdn =
  "https://scontent.cdninstagram.com/v/t51.2885-19/stale.jpg?oe=68500000";

test("mergeQuotationItemIntoProfileSource keeps enriched DNA avatar over expired line snapshot", () => {
  const merged = mergeQuotationItemIntoProfileSource(
    {
      displayName: "hebaelsopkey",
      avatarUrl: dnaAvatar,
      platform: "instagram",
      handle: "hebaelsopkey",
    },
    item({ profile_image_url: expiredCdn })
  );
  assert.equal(merged.avatarUrl, dnaAvatar);
});

test("mergeQuotationItemIntoProfileSource keeps displayable enriched avatar for browser proxy", () => {
  const merged = mergeQuotationItemIntoProfileSource(
    {
      displayName: "hebaelsopkey",
      avatarUrl: expiredCdn,
      platform: "instagram",
      handle: "hebaelsopkey",
    },
    item({ profile_image_url: expiredCdn })
  );
  assert.equal(merged.avatarUrl, expiredCdn);
});

test("buildQuotationCreatorProfileSource preserves server-enriched avatar without re-filtering", () => {
  const built = buildQuotationCreatorProfileSource(
    item({
      profile_image_url: expiredCdn,
      creator_profile_source: {
        displayName: "hebaelsopkey",
        avatarUrl: dnaAvatar,
        platform: "instagram",
        handle: "hebaelsopkey",
        linkedPlatforms: ["instagram"],
      },
    })
  );
  assert.equal(built.avatarUrl, dnaAvatar);
});

test("mergeQuotationItemIntoProfileSource does not resurrect expired line snapshot when enriched avatar is null", () => {
  const merged = mergeQuotationItemIntoProfileSource(
    {
      displayName: "abeer_kittchen",
      avatarUrl: null,
      platform: "instagram",
      handle: "abeer_kittchen",
    },
    item({ profile_image_url: expiredCdn })
  );
  assert.equal(merged.avatarUrl, null);
});
