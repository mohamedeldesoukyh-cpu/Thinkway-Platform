import assert from "node:assert/strict";

import { quotationItemsAvatarEnriched } from "@/features/quotations/export/quotation-export-avatars";
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
    profile_url: "https://www.instagram.com/creator/",
    creator_profile_source: {
      displayName: "Creator",
      avatarUrl: null,
      platform: "instagram",
      handle: "creator",
      profile_url: "https://www.instagram.com/creator/",
    },
    option_number: 1,
    service_description: null,
    commercial_input_mode: "cost_gp",
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

{
  const fresh =
    "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg?oe=6A539B1C";
  assert.equal(
    quotationItemsAvatarEnriched([
      item({
        profile_image_url: fresh,
        creator_profile_source: {
          displayName: "Creator",
          avatarUrl: fresh,
          platform: "instagram",
          handle: "creator",
          profile_url: "https://www.instagram.com/creator/",
        },
      }),
    ]),
    true,
    "usable avatar counts as enriched"
  );
}

{
  const expired =
    "https://scontent.cdninstagram.com/v/t51.2885-19/stale.jpg?oe=68500000";
  assert.equal(
    quotationItemsAvatarEnriched([
      item({
        profile_image_url: expired,
        creator_profile_source: {
          displayName: "Creator",
          avatarUrl: expired,
          platform: "instagram",
          handle: "creator",
          profile_url: "https://www.instagram.com/creator/",
        },
      }),
    ]),
    false,
    "expired CDN avatar must re-enrich from influencer"
  );
}

{
  assert.equal(
    quotationItemsAvatarEnriched([
      item({
        influencer_id: null,
        profile_id: null,
        unified_id: null,
        creator_profile_source: null,
      }),
    ]),
    true,
    "lines without creator refs skip enrichment"
  );
}

console.log("quotation-export-avatars.test.ts passed");
