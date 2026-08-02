import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyContentMixTypes,
  classifyPostCategories,
  classifySponsored,
  type CategoryBrandPostFact,
} from "@/lib/enterprise-creator-intelligence/category-brand/classify";
import {
  assertPercentTotal100,
  normalizeToHundred,
} from "@/lib/enterprise-creator-intelligence/category-brand/distribution";
import {
  computeCreatorCategoryBrandIntelligence,
  type CreatorCategoryBrandFacts,
} from "@/lib/enterprise-creator-intelligence/category-brand/compute";
import { CATEGORY_BRAND_CONSUMERS } from "@/lib/enterprise-creator-intelligence/category-brand/types";

function post(overrides: Partial<CategoryBrandPostFact>): CategoryBrandPostFact {
  return {
    caption: null,
    hashtags: [],
    mentions: [],
    postedAt: "2026-07-15T00:00:00.000Z",
    url: "https://instagram.com/p/abc",
    isVideo: false,
    productType: null,
    mediaType: null,
    type: null,
    campaignType: null,
    ...overrides,
  };
}

function facts(posts: CategoryBrandPostFact[]): CreatorCategoryBrandFacts {
  return {
    influencerId: "inf-cat-1",
    platform: "instagram",
    computedAt: "2026-08-02T00:00:00.000Z",
    posts,
  };
}

describe("Enterprise Creator Intelligence — Category & Brand Sprint 3", () => {
  it("normalizes category percentages to exactly 100", () => {
    const rows = normalizeToHundred(
      new Map([
        ["Travel", 45],
        ["Lifestyle", 25],
        ["Luxury", 15],
        ["Food", 10],
        ["Other", 5],
      ])
    );
    assert.equal(
      rows.reduce((sum, row) => sum + row.percent, 0),
      100
    );
    assert.ok(assertPercentTotal100(rows));
  });

  it("classifies categories, sponsored, and content mix from posts", () => {
    const categories = classifyPostCategories(
      post({
        caption: "Sunset in Bali #travel #lifestyle food market vibes",
        hashtags: ["travel", "lifestyle", "food"],
      })
    );
    assert.ok(categories.includes("Travel"));
    assert.ok(categories.includes("Lifestyle"));
    assert.ok(categories.includes("Food"));

    assert.equal(
      classifySponsored(
        post({ caption: "Thanks brand #ad #sponsored for the trip" })
      ),
      "Sponsored"
    );
    assert.equal(
      classifySponsored(post({ caption: "Morning coffee at home" })),
      "Organic"
    );

    const mix = classifyContentMixTypes(
      post({
        url: "https://www.instagram.com/reel/xyz/",
        productType: "clips",
        isVideo: true,
      })
    );
    assert.ok(mix.includes("Reels"));
    assert.ok(mix.includes("Short Form"));
  });

  it("computes windows, brands, affinity, specialisation, consistency", () => {
    const result = computeCreatorCategoryBrandIntelligence(
      facts([
        post({
          caption: "Exploring Tokyo #travel with @japanairlines",
          hashtags: ["travel"],
          mentions: ["japanairlines"],
          postedAt: "2026-07-20T00:00:00.000Z",
          url: "https://instagram.com/reel/1",
          productType: "clips",
          isVideo: true,
        }),
        post({
          caption: "Airport lounge lifestyle #travel #lifestyle #ad",
          hashtags: ["travel", "lifestyle", "ad"],
          mentions: ["japanairlines"],
          postedAt: "2026-07-10T00:00:00.000Z",
          campaignType: "reel",
        }),
        post({
          caption: "Home cooking #food recipe night",
          hashtags: ["food"],
          mentions: ["localkitchen"],
          postedAt: "2026-06-01T00:00:00.000Z",
        }),
        post({
          caption: "Mountain road trip #travel",
          hashtags: ["travel"],
          postedAt: "2026-03-01T00:00:00.000Z",
        }),
        post({
          caption: "Fashion week looks #fashion",
          hashtags: ["fashion"],
          postedAt: "2025-12-01T00:00:00.000Z",
        }),
      ])
    );

    const lifetime = result.windows.lifetime;
    assert.ok(lifetime.analysedPostCount >= 5);
    assert.equal(lifetime.totalPercent, 100);
    assert.ok(assertPercentTotal100(lifetime.categories));
    assert.ok(assertPercentTotal100(lifetime.contentMix));

    for (const share of lifetime.categories) {
      assert.ok(share.confidence.percent != null);
      assert.ok(share.confidence.reason.length > 0);
      assert.ok(share.explainability.meaning.length > 0);
      assert.ok(share.source.analysisMethod.length > 0);
      assert.ok(share.trend);
    }

    assert.ok(result.brands.length >= 1);
    const airline = result.brands.find((b) =>
      b.brandName.toLowerCase().includes("japan")
    );
    assert.ok(airline);
    assert.ok(airline!.mentionCount >= 2);
    assert.ok(airline!.affinity.includes("Repeated Collaborations"));
    assert.equal(airline!.sentimentExtension.available, false);

    assert.ok(result.specialisation.level);
    assert.ok(result.specialisation.why.length > 0);
    assert.ok(result.contentConsistency.level);
    assert.ok(result.businessReadiness.primaryCategories.length >= 1);
    assert.ok(result.businessReadiness.categoryConfidence != null);
    assert.deepEqual([...result.consumers], [...CATEGORY_BRAND_CONSUMERS]);
    assert.equal(result.aiHints.available, true);
  });

  it("exposes explainability and source attribution on readiness insights", () => {
    const result = computeCreatorCategoryBrandIntelligence(
      facts([
        post({
          caption: "Travel diary #travel",
          hashtags: ["travel"],
          postedAt: "2026-07-01T00:00:00.000Z",
        }),
      ])
    );
    assert.ok(result.specialisation.explainability.evidence.length > 0);
    assert.ok(result.contentConsistency.explainability.dataSource.platform);
    assert.equal(result.source.contentSource.includes("recent_publications"), true);
    assert.ok(result.windows.last_30_days);
    assert.ok(result.windows.last_90_days);
    assert.ok(result.windows.last_180_days);
    assert.ok(result.windows.lifetime);
  });

  it("handles missing posts with missing-input explainability", () => {
    const result = computeCreatorCategoryBrandIntelligence(facts([]));
    assert.equal(result.windows.lifetime.analysedPostCount, 0);
    assert.deepEqual(result.windows.lifetime.categories, []);
    assert.equal(result.aiHints.recommendRefresh, true);
    assert.ok(
      result.contentConsistency.explainability.missingInputs.includes("posts")
    );
  });
});
