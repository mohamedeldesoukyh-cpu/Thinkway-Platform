import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DiscoveryMappedFilter } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping/types";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import {
  applyEnterpriseConstraints,
  classifyEnterpriseConstraints,
  creatorSatisfiesMandatoryConstraints,
} from "./enterprise-constraint-engine";

function filter(
  key: DiscoveryMappedFilter["key"],
  value: string,
  label = key
): DiscoveryMappedFilter {
  return {
    id: `${key}-${value}`,
    key,
    label,
    value,
    weight: 100,
    confidence: 0.9,
  };
}

function creator(
  overrides: Partial<UnifiedCreatorResult> & {
    country_code?: string | null;
    platforms?: UnifiedCreatorResult["platforms"];
  } = {}
): UnifiedCreatorResult {
  const country = overrides.country_code ?? "EG";
  return {
    unified_id: "inf:1",
    source_type: "influencer",
    influencer_id: "1",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Test Creator",
    status: "active",
    country_code: country,
    country_codes: [country],
    categories: [],
    language_codes: ["ar"],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: 10000, confidence: "verified" },
      engagement_rate: { value: 0.06, confidence: "verified" },
      avg_views: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: 80,
    thinkway_score: 90,
    source_confidence: 80,
    brand_fit_score: 70,
    is_platform_verified: false,
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "test",
        profile_url: null,
        follower_count: 10000,
        engagement_rate: 0.06,
        audience_country: country,
        is_verified: false,
      },
    ],
    ...overrides,
    // Keep geo fields consistent after spread (overrides may set country_code only).
    country_code: overrides.country_code ?? country,
    country_codes: overrides.country_codes ?? [overrides.country_code ?? country],
  } as UnifiedCreatorResult;
}

describe("enterprise-constraint-engine", () => {
  it("classifies country and platform as mandatory", () => {
    const plan = classifyEnterpriseConstraints([
      filter("creator_country", "Egypt", "Creator Country"),
      filter("platform", "instagram", "Platform"),
      filter("category", "lifestyle", "Category"),
    ]);
    assert.equal(plan.mandatory.length, 2);
    assert.ok(plan.mandatory.some((c) => c.key === "creator_country" && c.value === "EG"));
    assert.ok(plan.mandatory.some((c) => c.key === "platform" && c.value === "instagram"));
    assert.equal(plan.preferred.length, 1);
  });

  it("never keeps foreign creators when country is mandatory", () => {
    const mapped = [
      filter("creator_country", "EG", "Creator Country"),
      filter("platform", "instagram", "Platform"),
    ];
    const eg = creator({ country_code: "EG" });
    const us = creator({
      unified_id: "inf:2",
      influencer_id: "2",
      country_code: "US",
      country_codes: ["US"],
    });
    const result = applyEnterpriseConstraints([eg, us], mapped);
    assert.equal(result.creators.length, 1);
    assert.equal(result.creators[0]?.country_code, "EG");
    assert.equal(result.rejectedMandatoryCount, 1);
  });

  it("rejects off-platform creators when platform is mandatory", () => {
    const mapped = [filter("platform", "instagram", "Platform")];
    const ig = creator();
    const yt = creator({
      unified_id: "inf:3",
      platforms: [
        {
          id: "pa-yt",
          platform: "youtube",
          handle: "yt",
          profile_url: null,
          follower_count: 10000,
          engagement_rate: 0.05,
          audience_country: null,
          is_verified: false,
        },
      ],
    });
    assert.equal(creatorSatisfiesMandatoryConstraints(ig, classifyEnterpriseConstraints(mapped).mandatory), true);
    assert.equal(creatorSatisfiesMandatoryConstraints(yt, classifyEnterpriseConstraints(mapped).mandatory), false);
  });

  it("records preferred relaxation when no creator meets preferred category", () => {
    const mapped = [
      filter("creator_country", "EG", "Creator Country"),
      filter("category", "finance", "Category"),
    ];
    const eg = creator({ categories: ["lifestyle"] });
    const result = applyEnterpriseConstraints([eg], mapped);
    assert.equal(result.creators.length, 1);
    assert.ok(result.relaxations.some((r) => r.key === "category"));
    assert.ok(result.relaxations[0]?.businessImpact);
  });

  it("does not hard-reject creators with missing language or authenticity metadata", () => {
    const mapped = [
      filter("creator_country", "EG", "Creator Country"),
      filter("language", "ar", "Language"),
      filter("brand_safety_min", "70", "Brand Safety"),
    ];
    const missingMeta = creator({
      language_codes: [],
      authenticity_score: null,
      brand_fit_score: null,
    });
    const belowSafety = creator({
      unified_id: "inf:low",
      authenticity_score: 40,
    });
    const result = applyEnterpriseConstraints([missingMeta, belowSafety], mapped);
    assert.equal(result.creators.length, 1);
    assert.equal(result.creators[0]?.unified_id, "inf:1");
    assert.equal(result.rejectedMandatoryCount, 1);
  });
});
