import assert from "node:assert/strict";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  bootstrapPlatformOptionsFromItem,
  mergeCreatorPlatformOptions,
  unionQuotationCreatorGroupPlatforms,
} from "@/lib/quotations/quotation-creator-platform-utils";
import { isPostTypeAllowedForCreator } from "@/lib/quotations/quotation-deliverable-types";

function mockItem(overrides?: Partial<QuotationItemRow>): QuotationItemRow {
  return {
    id: "item-1",
    influencer_id: "inf-1",
    profile_id: null,
    unified_id: "inf:inf-1",
    source_shortlist_item_id: null,
    creator_name: "Coach Ghofran",
    platform: null,
    handle: "coach_ghofran",
    followers: 100_000,
    engagement_rate: 3.2,
    country_code: "EG",
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

{
  const merged = mergeCreatorPlatformOptions(
    [
      {
        platform: "instagram",
        handle: "coach_ghofran",
        followers: 100_000,
        engagement_rate: 3.2,
      },
      {
        platform: "facebook",
        handle: "coach_ghofran",
        followers: 100_000,
        engagement_rate: 3.2,
      },
    ],
    [
      {
        platform: "instagram",
        handle: "coach_ghofran",
        followers: 100_000,
        engagement_rate: 3.2,
      },
      {
        platform: "tiktok",
        handle: "coach_ghofran",
        followers: 80_000,
        engagement_rate: 2.1,
      },
    ]
  );
  assert.deepEqual(
    merged.map((option) => option.platform).sort(),
    ["facebook", "instagram", "tiktok"]
  );
}

{
  const bootstrap = bootstrapPlatformOptionsFromItem(
    mockItem({
      creator_profile_source: {
        displayName: "Coach Ghofran",
        linkedPlatforms: ["instagram", "facebook"],
        handle: "coach_ghofran",
      },
    })
  );
  const allowed = mergeCreatorPlatformOptions(bootstrap, [
    {
      platform: "instagram",
      handle: "coach_ghofran",
      followers: 100_000,
      engagement_rate: 3.2,
    },
    {
      platform: "tiktok",
      handle: "coach_ghofran",
      followers: 80_000,
      engagement_rate: 2.1,
    },
  ]).map((option) => option.platform);

  assert.equal(isPostTypeAllowedForCreator("facebook_post", allowed), true);
  assert.equal(isPostTypeAllowedForCreator("facebook_reel", allowed), true);
  assert.equal(isPostTypeAllowedForCreator("tiktok_video", allowed), true);
}

{
  const platforms = unionQuotationCreatorGroupPlatforms([
    mockItem({
      id: "opt-1",
      platform: "instagram",
      deliverables: [
        {
          type: "instagram_reel",
          types: ["instagram_reel"],
          platform: "instagram",
          service_description: null,
          cost: 0,
          revenue: 0,
          gp_pct: 0,
          gp_value: 0,
        },
      ],
    }),
    mockItem({
      id: "opt-2",
      platform: "tiktok",
      option_number: 2,
      deliverables: [
        {
          type: "tiktok_video",
          types: ["tiktok_video"],
          platform: "tiktok",
          service_description: null,
          cost: 0,
          revenue: 0,
          gp_pct: 0,
          gp_value: 0,
        },
      ],
    }),
  ]);
  assert.deepEqual(platforms, ["instagram", "tiktok"]);
}

console.log("quotation-creator-platform-options.test.ts — all tests passed");
