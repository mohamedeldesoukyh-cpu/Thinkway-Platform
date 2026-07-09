import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { rerankCreatorsByCampaignFit } from "@/lib/discovery/campaign-fit-rerank";

function mockCreator(id: string, score: number): UnifiedCreatorResult {
  return {
    unified_id: id,
    source_type: "internal",
    influencer_id: id,
    discovered_profile_id: null,
    document_number: null,
    display_name: `Creator ${id}`,
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: ["beauty"],
    language_codes: ["ar"],
    profile_image_url: null,
    bio: "Beauty creator",
    metrics: {
      followers: { value: 50_000, confidence: "estimated" },
      engagement_rate: { value: 2.5, confidence: "estimated" },
      avg_likes: { value: 0, confidence: "estimated" },
      avg_comments: { value: 0, confidence: "estimated" },
      avg_views: { value: 0, confidence: "estimated" },
      posting_frequency_per_week: { value: 0, confidence: "estimated" },
    },
    ai_category: "Beauty",
    ai_niche: "Skincare",
    authenticity_score: 70,
    thinkway_score: 65,
    source_confidence: 0.8,
    brand_fit_score: 60,
    is_platform_verified: false,
    platforms: [
      {
        id: `${id}-pa`,
        platform: "instagram",
        handle: id,
        profile_url: null,
        follower_count: 50_000,
        engagement_rate: 2.5,
        audience_country: "EG",
        is_verified: false,
        profile_picture_url: null,
      },
    ],
    campaign_relevance_score: score,
  } as UnifiedCreatorResult;
}

test("rerankCreatorsByCampaignFit falls back without API key", async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const creators = [mockCreator("a", 90), mockCreator("b", 40)];
    const profile = { objectives: ["Skincare awareness"] } as CampaignIntelligenceProfile;
    const result = await rerankCreatorsByCampaignFit(creators, profile);

    assert.equal(result.rerank.usedLlm, false);
    assert.equal(result.creators[0]?.unified_id, "a");
    assert.equal(result.creators[1]?.unified_id, "b");
  } finally {
    if (original) process.env.OPENAI_API_KEY = original;
  }
});

test("rerankCreatorsByCampaignFit preserves single-creator pool", async () => {
  const creators = [mockCreator("solo", 75)];
  const profile = {} as CampaignIntelligenceProfile;
  const result = await rerankCreatorsByCampaignFit(creators, profile);
  assert.equal(result.creators.length, 1);
  assert.equal(result.creators[0]?.unified_id, "solo");
});
