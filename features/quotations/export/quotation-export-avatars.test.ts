import assert from "node:assert/strict";

import {
  quotationItemsAvatarEnriched,
  quotationItemsCategoriesEnriched,
  quotationItemsExportMetricsReady,
  quotationItemsFullyEnrichedForExport,
} from "@/features/quotations/export/quotation-export-avatars";
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
    creator_categories: ["Beauty"],
    creator_profile_source: {
      displayName: "Creator",
      avatarUrl: null,
      platform: "instagram",
      handle: "creator",
      profile_url: "https://www.instagram.com/creator/",
    },
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

{
  const fresh =
    "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg?oe=6A539B1C";
  assert.equal(
    quotationItemsAvatarEnriched([
      item({
        profile_image_url: fresh,
        creator_categories: ["Beauty"],
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
        creator_categories: [],
      }),
    ]),
    true,
    "lines without creator refs skip avatar enrichment"
  );
}

{
  assert.equal(
    quotationItemsCategoriesEnriched([
      item({
        influencer_id: null,
        profile_id: null,
        unified_id: null,
        creator_profile_source: null,
        creator_categories: ["Beauty"],
      }),
    ]),
    true,
    "main-category tags count as category-enriched"
  );
}

{
  assert.equal(
    quotationItemsCategoriesEnriched([
      item({
        influencer_id: null,
        profile_id: null,
        unified_id: null,
        creator_profile_source: null,
        creator_categories: ["General influencer"],
      }),
    ]),
    false,
    "non-mapping stored tags must re-run category inference"
  );
}

{
  assert.equal(
    quotationItemsFullyEnrichedForExport([
      item({
        profile_image_url:
          "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg?oe=6A539B1C",
        creator_categories: ["General influencer"],
        creator_profile_source: {
          displayName: "Creator",
          avatarUrl:
            "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg?oe=6A539B1C",
          platform: "instagram",
          handle: "creator",
          profile_url: "https://www.instagram.com/creator/",
        },
      }),
    ]),
    false,
    "usable avatar with non-mapping categories must re-enrich"
  );
}

{
  const fresh =
    "https://scontent.cdninstagram.com/v/t51.2885-19/fresh.jpg?oe=6A539B1C";
  assert.equal(
    quotationItemsExportMetricsReady([
      item({
        id: "item-1",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: null,
        followers: null,
        profile_image_url: fresh,
        creator_profile_source: {
          displayName: "hgabr",
          avatarUrl: fresh,
          platform: null,
          linkedPlatforms: ["instagram", "tiktok"],
          handle: "hgabr",
          profile_url: "https://www.instagram.com/hgabr/",
        },
      }),
      item({
        id: "item-2",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: "instagram",
        followers: 639_850,
        sort_order: 1,
        profile_image_url: fresh,
        creator_profile_source: {
          displayName: "hgabr",
          avatarUrl: fresh,
          platform: "instagram",
          handle: "hgabr",
          profile_url: "https://www.instagram.com/hgabr/",
        },
      }),
    ]),
    true,
    "group-level metrics merge satisfies export readiness"
  );

  assert.equal(
    quotationItemsExportMetricsReady([
      item({
        id: "item-1",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: null,
        followers: null,
        profile_image_url: fresh,
        creator_profile_source: {
          displayName: "hgabr",
          avatarUrl: fresh,
          platform: null,
          linkedPlatforms: ["instagram", "tiktok"],
          handle: "hgabr",
        },
      }),
      item({
        id: "item-2",
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: null,
        followers: null,
        sort_order: 1,
        profile_image_url: fresh,
        creator_profile_source: {
          displayName: "hgabr",
          avatarUrl: fresh,
          platform: null,
          linkedPlatforms: ["instagram", "tiktok"],
          handle: "hgabr",
        },
      }),
    ]),
    false,
    "missing group platform and followers must trigger re-enrichment"
  );

  assert.equal(
    quotationItemsFullyEnrichedForExport([
      item({
        profile_image_url: fresh,
        creator_categories: ["Beauty"],
        influencer_id: "inf-hgabr",
        handle: "hgabr",
        platform: null,
        followers: null,
        creator_profile_source: {
          displayName: "hgabr",
          avatarUrl: fresh,
          platform: null,
          linkedPlatforms: ["instagram", "tiktok"],
          handle: "hgabr",
        },
      }),
    ]),
    false,
    "avatar-enriched lines without export metrics must re-enrich"
  );
}

console.log("quotation-export-avatars.test.ts passed");
