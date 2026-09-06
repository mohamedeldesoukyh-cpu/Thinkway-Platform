import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/creators/types";
import {
  accumulateDiscoveryAudienceScanPage,
  applyDiscoveryBrowseFilters,
  creatorMatchesDiscoveryBrowseFilters,
  hasDiscoveryAudienceBrowseFilters,
  isDiscoveryAudienceRawPoolExhausted,
  requiresDiscoveryAudienceScanPath,
} from "@/lib/creators/discovery-browse-filters";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

function makeCreator(
  partial: Partial<UnifiedCreatorResult> & Pick<UnifiedCreatorResult, "unified_id">
): UnifiedCreatorResult {
  return {
    source_type: "imported",
    influencer_id: partial.unified_id.replace("inf:", ""),
    discovered_profile_id: null,
    document_number: "TW-TEST-1",
    display_name: "Creator",
    status: "active",
    country_code: "EG",
    estimated_country: "EG",
    city: null,
    categories: [],
    language_codes: [],
    profile_image_url: null,
    metrics: {
      followers: { value: 1000, confidence: "verified" },
      engagement_rate: { value: 1.2, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 50,
    source_confidence: 80,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    bio: null,
    ...partial,
  };
}

test("hasDiscoveryAudienceBrowseFilters detects audience chips", () => {
  assert.equal(hasDiscoveryAudienceBrowseFilters({}), false);
  assert.equal(
    hasDiscoveryAudienceBrowseFilters({ audienceCountries: ["AE"] }),
    true
  );
  assert.equal(
    hasDiscoveryAudienceBrowseFilters({ audienceInterestTags: ["Beauty"] }),
    true
  );
});

test("requiresDiscoveryAudienceScanPath excludes gender/age-only filters", () => {
  assert.equal(requiresDiscoveryAudienceScanPath({ audienceGender: "female" }), false);
  assert.equal(
    requiresDiscoveryAudienceScanPath({ audienceAgeMin: "25", audienceAgeMax: "34" }),
    false
  );
  assert.equal(requiresDiscoveryAudienceScanPath({ audienceCountries: ["AE"] }), true);
  assert.equal(requiresDiscoveryAudienceScanPath({ contentLanguages: ["ar"] }), true);
});

test("requiresDiscoveryAudienceScanPath excludes multi creatorCountries after Phase 1A", () => {
  assert.equal(
    requiresDiscoveryAudienceScanPath({
      country: "EG",
      creatorCountries: ["EG", "AE"],
    }),
    false
  );
});

test("creatorMatchesDiscoveryBrowseFilters enforces audience interest tags", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    audienceInterestTags: ["beauty & cosmetics"],
  };
  const match = makeCreator({
    unified_id: "inf:1",
    audience_interests: ["Beauty & Cosmetics"],
  });
  const miss = makeCreator({
    unified_id: "inf:2",
    audience_interests: ["Sports"],
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
  assert.equal(applyDiscoveryBrowseFilters([match, miss], filters).length, 1);
});

test("creatorMatchesDiscoveryBrowseFilters matches secondary country_codes entries", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    country: "CH",
  };
  const swissInList = makeCreator({
    unified_id: "inf:1",
    country_code: "AE",
    country_codes: ["AE", "CH", "TH"],
  });
  const noMatch = makeCreator({
    unified_id: "inf:2",
    country_code: "EG",
    country_codes: ["EG"],
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(swissInList, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(noMatch, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters accepts UAE via creator country fallback", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    audienceCountries: ["AE"],
  };
  const uaeCreator = makeCreator({
    unified_id: "inf:1",
    country_code: "AE",
    estimated_country: "AE",
  });
  const egCreator = makeCreator({
    unified_id: "inf:2",
    country_code: "EG",
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(uaeCreator, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(egCreator, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters accepts platform via filters.platform singular", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    platform: "instagram",
  };
  const match = makeCreator({
    unified_id: "inf:1",
    platforms: [
      {
        id: "pa-1",
        platform: "instagram",
        handle: "creator",
        profile_url: null,
        follower_count: 1000,
        engagement_rate: 1,
        audience_country: "EG",
        is_verified: false,
      },
    ],
  });
  const miss = makeCreator({
    unified_id: "inf:2",
    platforms: [
      {
        id: "pa-2",
        platform: "tiktok",
        handle: "creator",
        profile_url: null,
        follower_count: 1000,
        engagement_rate: 1,
        audience_country: "EG",
        is_verified: false,
      },
    ],
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters uses enriched demographics for gender", () => {
  const filters: UnifiedCreatorBrowseFilters = {
    audienceGender: "female",
    audienceAgeMin: "25",
    audienceAgeMax: "34",
  };
  const match = makeCreator({
    unified_id: "inf:1",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 10, "25_34": 55, "35_44": 20, "45_54": 5, "55_plus": 5 },
      gender: { male: 20, female: 78, unknown: 2 },
      topCountries: [{ code: "AE", name: "United Arab Emirates", percent: 60 }],
      topCities: null,
      source: "modash",
    },
  });
  const miss = makeCreator({
    unified_id: "inf:2",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 55, "25_34": 20, "35_44": 10, "45_54": 5, "55_plus": 5 },
      gender: { male: 70, female: 28, unknown: 2 },
      topCountries: [{ code: "AE", name: "United Arab Emirates", percent: 60 }],
      topCities: null,
      source: "modash",
    },
  });

  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters excludes missing demographics for gender", () => {
  const filters: UnifiedCreatorBrowseFilters = { audienceGender: "female" };
  const missing = makeCreator({
    unified_id: "inf:missing-demo",
    audience_demographics: null,
  });
  assert.equal(creatorMatchesDiscoveryBrowseFilters(missing, filters), false);
});

test("creatorMatchesDiscoveryBrowseFilters excludes empty language_codes when languages set", () => {
  const filters: UnifiedCreatorBrowseFilters = { languages: ["ar"] };
  const empty = makeCreator({ unified_id: "inf:no-lang", language_codes: [] });
  const arabic = makeCreator({ unified_id: "inf:ar", language_codes: ["ar"] });
  assert.equal(creatorMatchesDiscoveryBrowseFilters(empty, filters), false);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(arabic, filters), true);
});

test("isDiscoveryAudienceRawPoolExhausted ignores hydrated length semantics", () => {
  assert.equal(isDiscoveryAudienceRawPoolExhausted(80, 80), false);
  assert.equal(isDiscoveryAudienceRawPoolExhausted(80, 100), true);
  assert.equal(isDiscoveryAudienceRawPoolExhausted(30, 100), true);
  assert.equal(isDiscoveryAudienceRawPoolExhausted(0, 100), true);
  // Full raw pool must never look exhausted even if callers only hydrated 0–30 rows.
  assert.equal(isDiscoveryAudienceRawPoolExhausted(100, 100), false);
});

test("audience scan continues when raw pool is full but Phase 1A qualifies few matches", async () => {
  const BATCH = 80;
  const PAGE = 24;
  let fetches = 0;
  const result = await accumulateDiscoveryAudienceScanPage({
    page: 1,
    pageSize: PAGE,
    batchSize: BATCH,
    maxBatchPages: 5,
    fetchBatch: async (batchPage) => {
      fetches += 1;
      // Full raw pools while Phase 1A leaves only 30 hydrated each.
      if (batchPage <= 3) {
        return {
          rawCandidateCount: BATCH,
          creators: Array.from({ length: 30 }, (_, i) =>
            makeCreator({ unified_id: `inf:b${batchPage}-${i}` })
          ),
        };
      }
      return { rawCandidateCount: 0, creators: [] };
    },
    // Audience post-filter keeps 10 per batch → needs multiple batches for PAGE.
    applyFilters: (creators) => creators.slice(0, 10),
    sort: (creators) => creators,
  });

  assert.ok(fetches >= 2, "must continue to next raw pool batch when page underfilled");
  assert.equal(result.creators.length, PAGE);
  assert.equal(new Set(result.creators.map((c) => c.unified_id)).size, PAGE);
  assert.equal(result.has_more, true);
  assert.ok(result.total > PAGE, "lower-bound total while pool not exhausted");
});

test("audience scan can stop when page is full even if raw pool remains", async () => {
  const BATCH = 80;
  const PAGE = 24;
  let fetches = 0;
  const result = await accumulateDiscoveryAudienceScanPage({
    page: 1,
    pageSize: PAGE,
    batchSize: BATCH,
    maxBatchPages: 5,
    fetchBatch: async () => {
      fetches += 1;
      return {
        rawCandidateCount: BATCH,
        creators: Array.from({ length: 30 }, (_, i) =>
          makeCreator({ unified_id: `inf:full-${fetches}-${i}` })
        ),
      };
    },
    applyFilters: (creators) => creators, // 30 matches ≥ PAGE
    sort: (creators) => creators,
  });

  assert.equal(fetches, 1, "stop once page is filled");
  assert.equal(result.creators.length, PAGE);
  assert.equal(result.has_more, true);
});

test("audience scan marks exhausted when raw pool itself is short", async () => {
  const BATCH = 80;
  const result = await accumulateDiscoveryAudienceScanPage({
    page: 1,
    pageSize: 24,
    batchSize: BATCH,
    maxBatchPages: 5,
    fetchBatch: async () => ({
      rawCandidateCount: 30,
      creators: Array.from({ length: 10 }, (_, i) =>
        makeCreator({ unified_id: `inf:short-${i}` })
      ),
    }),
    applyFilters: (creators) => creators,
    sort: (creators) => creators,
  });

  assert.equal(result.creators.length, 10);
  assert.equal(result.has_more, false);
  assert.equal(result.total, 10, "exact total when raw pool exhausted");
});

test("audience scan continues when qualified/hydrated count is zero on a full raw pool", async () => {
  const BATCH = 80;
  let fetches = 0;
  const result = await accumulateDiscoveryAudienceScanPage({
    page: 1,
    pageSize: 24,
    batchSize: BATCH,
    maxBatchPages: 4,
    fetchBatch: async (batchPage) => {
      fetches += 1;
      if (batchPage === 1) {
        return { rawCandidateCount: BATCH, creators: [] }; // Phase 1A wiped the page
      }
      if (batchPage === 2) {
        return {
          rawCandidateCount: BATCH,
          creators: Array.from({ length: 40 }, (_, i) =>
            makeCreator({ unified_id: `inf:recover-${i}` })
          ),
        };
      }
      return { rawCandidateCount: 0, creators: [] };
    },
    applyFilters: (creators) => creators,
    sort: (creators) => creators,
  });

  assert.ok(fetches >= 2, "zero hydrated on full raw pool must not terminate scan");
  assert.equal(result.creators.length, 24);
  assert.equal(result.has_more, true);
});

test("audience scan dedupes creators across batches", async () => {
  const BATCH = 80;
  const result = await accumulateDiscoveryAudienceScanPage({
    page: 1,
    pageSize: 24,
    batchSize: BATCH,
    maxBatchPages: 3,
    fetchBatch: async (batchPage) => ({
      rawCandidateCount: BATCH,
      creators: [
        makeCreator({ unified_id: "inf:dup" }),
        makeCreator({ unified_id: `inf:unique-${batchPage}` }),
        ...Array.from({ length: 20 }, (_, i) =>
          makeCreator({ unified_id: `inf:b${batchPage}-n${i}` })
        ),
      ],
    }),
    applyFilters: (creators) => creators,
    sort: (creators) => creators,
  });

  const ids = result.creators.map((c) => c.unified_id);
  assert.equal(ids.filter((id) => id === "inf:dup").length, 1);
  assert.equal(new Set(ids).size, ids.length);
});

test("source: audience scan uses rawCandidateCount not hydrated length for exhaustion", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-browse.ts"),
    "utf8"
  );
  assert.match(source, /accumulateDiscoveryAudienceScanPage/);
  assert.match(source, /rawCandidateCount/);
  assert.doesNotMatch(
    source,
    /if \(batch\.length < DISCOVERY_AUDIENCE_FILTER_BATCH\) rawExhausted/
  );
  assert.match(
    source,
    /rawCandidateCount:\s*internalPage\.rawCandidateCount/
  );
});
