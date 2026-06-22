import assert from "node:assert/strict";

import { passesProductionCreatorGate } from "@/lib/creators/production-filter";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function baseCreator(overrides: Partial<UnifiedCreatorResult>): UnifiedCreatorResult {
  return {
    unified_id: "dis:1",
    source_type: "public_discovery",
    influencer_id: null,
    discovered_profile_id: "p1",
    document_number: null,
    display_name: "Test",
    status: "discovered",
    country_code: "AE",
    estimated_country: "AE",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: 1000, confidence: "estimated" },
      engagement_rate: { value: 2, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 50,
    source_confidence: 50,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    ...overrides,
  };
}

assert.equal(
  passesProductionCreatorGate(
    baseCreator({ source_type: "internal", influencer_id: "inf-1", status: "active" })
  ),
  true
);

assert.equal(
  passesProductionCreatorGate(
    baseCreator({ status: "discovered", bio: "collabs: test@example.com" })
  ),
  false
);

assert.equal(passesProductionCreatorGate(baseCreator({ status: "verified" })), true);
