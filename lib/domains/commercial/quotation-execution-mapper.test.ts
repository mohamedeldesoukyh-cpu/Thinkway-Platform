import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  mapQuotationItemsToExecutionLineSeeds,
  quotationDeliverablesToPlatforms,
  type QuotationItemExecutionRow,
} from "./quotation-execution-mapper";

function creatorWithPlatforms(
  platforms: Array<{ platform: string; handle: string }>
): UnifiedCreatorResult {
  return {
    unified_id: "creator-1",
    source_type: "influencer",
    influencer_id: "11111111-1111-1111-1111-111111111111",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Eman Abdullah",
    status: null,
    country_code: null,
    estimated_country: null,
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: null, confidence: "estimated" },
      engagement_rate: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 0,
    source_confidence: 0,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: platforms.map((p, index) => ({
      id: `acct-${index + 1}`,
      platform: p.platform,
      handle: p.handle,
      profile_url: null,
      follower_count: 1000,
      engagement_rate: null,
      audience_country: null,
    })),
  };
}

describe("quotationDeliverablesToPlatforms", () => {
  it("places each selected type on its native/mirrored platform only", () => {
    const creator = creatorWithPlatforms([
      { platform: "instagram", handle: "wasafatibyeman" },
      { platform: "tiktok", handle: "wasafatibyeman" },
      { platform: "youtube", handle: "wasafatibyeman" },
      { platform: "facebook", handle: "wasafatibyeman" },
    ]);

    const item: QuotationItemExecutionRow = {
      id: "item-1",
      influencer_id: creator.influencer_id,
      unified_id: creator.unified_id,
      creator_name: "Eman Abdullah",
      platform: "instagram,tiktok,youtube,facebook",
      handle: "wasafatibyeman",
      deliverables: [
        {
          platform: "instagram,tiktok,youtube,facebook",
          types: [
            "instagram_reel",
            "ig_story_set",
            "mirrored_tt",
            "mirrored_fb",
            "mirrored_yt",
          ],
          quantity: 1,
        },
      ],
      cost: 1000,
      revenue: 2000,
      cost_currency: "EGP",
      option_number: null,
    };

    const platforms = quotationDeliverablesToPlatforms(
      item.deliverables ?? [],
      creator,
      item
    );

    const byPlatform = Object.fromEntries(
      platforms.map((p) => [p.platform, [...p.deliverables].sort()])
    );

    assert.deepEqual(byPlatform, {
      instagram: ["ig_story_set", "instagram_reel"],
      tiktok: ["mirrored_tt"],
      facebook: ["mirrored_fb"],
      youtube: ["mirrored_yt"],
    });

    // Must not explode into type × platform combinations.
    const totalUnits = platforms.reduce((sum, p) => sum + p.deliverables.length, 0);
    assert.equal(totalUnits, 5);
  });

  it("keeps platform-agnostic types on the primary package platform", () => {
    const creator = creatorWithPlatforms([
      { platform: "instagram", handle: "creator" },
      { platform: "tiktok", handle: "creator" },
    ]);
    const item: QuotationItemExecutionRow = {
      id: "item-2",
      influencer_id: creator.influencer_id,
      unified_id: creator.unified_id,
      creator_name: "Creator",
      platform: "instagram,tiktok",
      handle: "creator",
      deliverables: [
        {
          platform: "instagram,tiktok",
          types: ["visit", "event_coverage"],
          quantity: 1,
        },
      ],
      cost: 100,
      revenue: 200,
      cost_currency: "EGP",
      option_number: null,
    };

    const platforms = quotationDeliverablesToPlatforms(
      item.deliverables ?? [],
      creator,
      item
    );

    assert.equal(platforms.length, 1);
    assert.equal(platforms[0].platform, "instagram");
    assert.deepEqual([...platforms[0].deliverables].sort(), [
      "event_coverage",
      "visit",
    ]);
  });

  it("maps through convert seed builder without type explosion", () => {
    const creator = creatorWithPlatforms([
      { platform: "instagram", handle: "wasafatibyeman" },
      { platform: "tiktok", handle: "wasafatibyeman" },
    ]);
    const influencerId = creator.influencer_id!;
    const seeds = mapQuotationItemsToExecutionLineSeeds({
      items: [
        {
          id: "item-3",
          influencer_id: influencerId,
          unified_id: creator.unified_id,
          creator_name: "Eman Abdullah",
          platform: "instagram,tiktok",
          handle: "wasafatibyeman",
          deliverables: [
            {
              platform: "instagram,tiktok",
              types: ["instagram_reel", "mirrored_tt"],
              quantity: 1,
            },
          ],
          cost: 500,
          revenue: 1000,
          cost_currency: "EGP",
          option_number: null,
        },
      ],
      creators: [creator],
      influencerIdByCreatorId: new Map([["creator-1", influencerId]]),
      defaultCurrency: "EGP",
    });

    assert.equal(seeds.length, 1);
    assert.deepEqual(
      Object.fromEntries(
        seeds[0].platforms.map((p) => [p.platform, p.deliverables])
      ),
      {
        instagram: ["instagram_reel"],
        tiktok: ["mirrored_tt"],
      }
    );
  });
});
