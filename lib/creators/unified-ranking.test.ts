/**
 * Discovery Rank v2 — Phase 2 intelligent ranking tests.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  discoveryRankDnaSignalsEnabled,
  scoreDiscoveryRankV2,
  sortCreatorsForCategoryFill,
  sortCreatorsForFilteredFastFill,
  sortCreatorsForFtsFill,
} from "@/lib/creators/unified-ranking";
import { BROWSE_PIN_PRIORITY_COUNTRY } from "@/lib/creators/browse-pin-tier";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

function baseCreator(
  id: string,
  overrides: Partial<UnifiedCreatorResult> = {}
): UnifiedCreatorResult {
  return {
    unified_id: id,
    source_type: "internal",
    influencer_id: id,
    discovered_profile_id: null,
    document_number: null,
    display_name: id,
    status: "active",
    country_code: "US",
    estimated_country: null,
    city: null,
    categories: [],
    browse_category_tags: [],
    language_codes: [],
    profile_image_url: null,
    primaryAvatarUrl: null,
    primaryAvatarSource: "placeholder",
    bio: null,
    metrics: {
      followers: { value: null, confidence: "low" },
      engagement_rate: { value: null, confidence: "low" },
      avg_likes: { value: null, confidence: "low" },
      avg_comments: { value: null, confidence: "low" },
      avg_views: { value: null, confidence: "low" },
      posting_frequency_per_week: { value: null, confidence: "low" },
    },
    thinkway_score: 50,
    authenticity_score: null,
    brand_fit_score: null,
    ai_category: null,
    ai_niche: null,
    dna_completeness: null,
    historical_performance_score: null,
    source_confidence: 0.7,
    enrichment_status: "partial",
    platforms: [],
    search_rank: null,
    last_enriched_at: null,
    updated_at: null,
    ...overrides,
  } as UnifiedCreatorResult;
}

test("rank v2 is deterministic for identical inputs", () => {
  const creators = [
    baseCreator("a", {
      search_rank: 800,
      thinkway_score: 70,
      metrics: {
        followers: { value: 10000, confidence: "high" },
        engagement_rate: { value: 3, confidence: "high" },
        avg_likes: { value: null, confidence: "low" },
        avg_comments: { value: null, confidence: "low" },
        avg_views: { value: 5000, confidence: "medium" },
        posting_frequency_per_week: { value: null, confidence: "low" },
      },
    }),
    baseCreator("b", {
      search_rank: 700,
      thinkway_score: 90,
      enrichment_status: "enriched",
      last_enriched_at: new Date().toISOString(),
    }),
  ];
  const once = sortCreatorsForFtsFill(creators, {
    intent: { categories: ["Beauty"] },
  }).map((c) => c.unified_id);
  const twice = sortCreatorsForFtsFill(creators, {
    intent: { categories: ["Beauty"] },
  }).map((c) => c.unified_id);
  assert.deepEqual(once, twice);
});

test("component breakdown omits missing signals; never invents brand_fit from thinkway", () => {
  const sparse = baseCreator("sparse", {
    thinkway_score: 80,
    brand_fit_score: null,
    dna_completeness: null,
    search_rank: null,
  });
  const ranked = scoreDiscoveryRankV2(sparse, { useDnaSignals: true });
  assert.equal(ranked.components.brandFit, null);
  assert.equal(ranked.components.dnaCompleteness, null);
  assert.equal(ranked.components.lexicalRelevance, null);
  assert.ok(ranked.components.thinkwayCompleteness != null);
  assert.ok(ranked.components.quality != null);
  assert.ok(ranked.confidence < 1);
  assert.ok(ranked.score >= 0 && ranked.score <= 1);
});

test("DNA signals ignored when flag/options disable them even if present", () => {
  const withDna = baseCreator("dna", {
    brand_fit_score: 95,
    dna_completeness: 90,
    authenticity_score: 88,
  });
  const off = scoreDiscoveryRankV2(withDna, { useDnaSignals: false });
  assert.equal(off.components.brandFit, null);
  assert.equal(off.components.dnaCompleteness, null);
  assert.equal(discoveryRankDnaSignalsEnabled(), process.env.DISCOVERY_RANK_USE_DNA_SIGNALS === "1");
});

test("FTS sort: higher search_rank wins over higher thinkway", () => {
  const lowFtsHighTw = baseCreator("low-fts", {
    search_rank: 400,
    thinkway_score: 99,
    enrichment_status: "enriched",
    last_enriched_at: new Date().toISOString(),
  });
  const highFtsLowTw = baseCreator("high-fts", {
    search_rank: 900,
    thinkway_score: 20,
  });
  const ordered = sortCreatorsForFtsFill([lowFtsHighTw, highFtsLowTw]);
  assert.equal(ordered[0]!.unified_id, "high-fts");
  assert.equal(ordered[1]!.unified_id, "low-fts");
});

test("category sort: equal scores preserve first-seen (RPC) order", () => {
  const a = baseCreator("rpc-a", { thinkway_score: 50, enrichment_status: "never" });
  const b = baseCreator("rpc-b", { thinkway_score: 50, enrichment_status: "never" });
  const ordered = sortCreatorsForCategoryFill([a, b]);
  assert.deepEqual(
    ordered.map((c) => c.unified_id),
    ["rpc-a", "rpc-b"]
  );
});

test("category sort: higher rank score may reorder, but no Egypt pin required", () => {
  const egyptWeak = baseCreator("eg-weak", {
    country_code: BROWSE_PIN_PRIORITY_COUNTRY,
    thinkway_score: 10,
    enrichment_status: "never",
  });
  const usStrong = baseCreator("us-strong", {
    country_code: "US",
    thinkway_score: 95,
    enrichment_status: "enriched",
    last_enriched_at: new Date().toISOString(),
    profile_image_url: "https://example.com/a.jpg",
    bio: "Creator bio",
    metrics: {
      followers: { value: 50000, confidence: "high" },
      engagement_rate: { value: 5, confidence: "high" },
      avg_likes: { value: null, confidence: "low" },
      avg_comments: { value: null, confidence: "low" },
      avg_views: { value: 20000, confidence: "high" },
      posting_frequency_per_week: { value: null, confidence: "low" },
    },
  });
  const ordered = sortCreatorsForCategoryFill([egyptWeak, usStrong]);
  assert.equal(ordered[0]!.unified_id, "us-strong");
});

test("filtered-fast sort: Egypt pin prior beats higher thinkway outside Egypt", () => {
  const egypt = baseCreator("eg", {
    country_code: BROWSE_PIN_PRIORITY_COUNTRY,
    enrichment_status: "enriched",
    last_enriched_at: new Date().toISOString(),
    thinkway_score: 40,
    platforms: [
      {
        id: "p1",
        platform: "instagram",
        handle: "eg1",
        profile_url: null,
        follower_count: 1,
        engagement_rate: 1,
        audience_country: BROWSE_PIN_PRIORITY_COUNTRY,
      },
      {
        id: "p2",
        platform: "tiktok",
        handle: "eg2",
        profile_url: null,
        follower_count: 1,
        engagement_rate: 1,
        audience_country: BROWSE_PIN_PRIORITY_COUNTRY,
      },
    ],
  });
  const us = baseCreator("us", {
    country_code: "US",
    enrichment_status: "enriched",
    last_enriched_at: new Date().toISOString(),
    thinkway_score: 99,
    platforms: [
      {
        id: "p3",
        platform: "instagram",
        handle: "us1",
        profile_url: null,
        follower_count: 1,
        engagement_rate: 1,
        audience_country: "US",
      },
      {
        id: "p4",
        platform: "tiktok",
        handle: "us2",
        profile_url: null,
        follower_count: 1,
        engagement_rate: 1,
        audience_country: "US",
      },
    ],
  });
  const ordered = sortCreatorsForFilteredFastFill([us, egypt]);
  assert.equal(ordered[0]!.unified_id, "eg");
});

test("campaign fit component activates only when criteria provided", () => {
  const creator = baseCreator("c1", {
    categories: ["Beauty"],
    browse_category_tags: ["Beauty"],
    bio: "skincare tips",
  });
  const without = scoreDiscoveryRankV2(creator, {});
  assert.equal(without.components.campaignFit, null);

  const withCriteria = scoreDiscoveryRankV2(creator, {
    campaignCriteria: [
      {
        id: "cat",
        label: "Category",
        filterKey: "categories",
        value: "Beauty",
        enabled: true,
        weight: 1,
      } as never,
    ],
  });
  assert.ok(withCriteria.components.campaignFit != null);
});

test("ECI investment fields must not appear in ranking source", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-ranking.ts"),
    "utf8"
  );
  assert.doesNotMatch(source, /eci_investment/);
  assert.doesNotMatch(source, /loadCreatorIntelligenceBundle/);
  assert.doesNotMatch(source, /enterprise-creator-intelligence/);
});

test("source wiring: fill paths use Phase 2 sort helpers; unfiltered unchanged", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-browse.ts"),
    "utf8"
  );
  assert.match(source, /sortCreatorsForFtsFill/);
  assert.match(source, /sortCreatorsForCategoryFill/);
  assert.match(source, /sortCreatorsForFilteredFastFill/);
  assert.match(source, /fast_unfiltered_browse/);
  assert.match(source, /hasFtsRank/);
  assert.match(source, /categoryOnly/);
  // Unfiltered must keep default pin sort, not FTS/category rank helpers as primary path.
  const unfilteredStart = source.indexOf('perf?.span("fast_unfiltered_browse")');
  const unfilteredEnd = source.indexOf('perf?.span("fts_browse_fill")', unfilteredStart);
  assert.ok(unfilteredStart > 0 && unfilteredEnd > unfilteredStart);
  const unfiltered = source.slice(unfilteredStart, unfilteredEnd);
  assert.match(unfiltered, /sortBrowseCreatorsInDefaultOrder/);
  assert.doesNotMatch(unfiltered, /sortCreatorsForFtsFill/);
  assert.doesNotMatch(unfiltered, /sortCreatorsForCategoryFill/);
});

test("fill accumulate still owns page slice — rank is sort callback only", () => {
  const fillSource = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/creator-browse-page-fill.ts"),
    "utf8"
  );
  assert.match(fillSource, /const sorted = sort\(uniqueFiltered\)/);
  assert.match(fillSource, /sorted\.slice\(offset, offset \+ pageSize\)/);
});
