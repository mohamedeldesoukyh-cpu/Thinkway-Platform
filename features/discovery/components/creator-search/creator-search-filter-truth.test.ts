import assert from "node:assert/strict";
import test from "node:test";

import {
  creatorMatchesMinViews,
  creatorMatchesDiscoveryBrowseFilters,
} from "@/lib/creators/discovery-browse-filters";
import {
  creatorMatchesLastPostWithin,
  latestCanonicalPublicationTimestamp,
} from "@/lib/creators/creator-last-post-filter";
import {
  CREATOR_SEARCH_FILTER_TRUTH_MATRIX,
  creatorSearchPricingFilterSupported,
  listClientOnlyCreatorSearchFilterKeys,
  resolveBrowseHydrationExtras,
} from "@/lib/creators/creator-search-filter-truth";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { filtersToBrowseParams } from "@/features/discovery/components/creator-search/creator-search-types";
import {
  applyCreatorSearchClientFilters,
  hasClientOnlyCreatorSearchFilters,
} from "@/features/discovery/components/creator-search/creator-search-client-filters";
import {
  cloneCreatorSearchFilters,
  DEFAULT_CREATOR_SEARCH_FILTERS,
  type CreatorSearchFilters,
} from "@/features/discovery/components/creator-search/creator-search-types";

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

function platform(
  platformName: string,
  handle = "creator",
  audienceCountry: string | null = null
): UnifiedCreatorResult["platforms"][number] {
  return {
    id: `pa-${platformName}`,
    platform: platformName,
    handle,
    profile_url: null,
    follower_count: 1000,
    engagement_rate: 1,
    audience_country: audienceCountry,
    is_verified: false,
  };
}

// ---------------------------------------------------------------------------
// Truth contract
// ---------------------------------------------------------------------------

test("Phase 0 truth matrix has no silent UNSUPPORTED active filters", () => {
  for (const row of CREATOR_SEARCH_FILTER_TRUTH_MATRIX) {
    if (row.classification === "UNSUPPORTED") {
      assert.equal(row.uiState, "disabled");
    }
    if (row.classification === "UI_DISABLED") {
      assert.equal(row.uiState, "disabled");
    }
  }
  assert.equal(creatorSearchPricingFilterSupported(), false);
});

test("resolveBrowseHydrationExtras stays slim when filters are absent", () => {
  assert.deepEqual(resolveBrowseHydrationExtras({}), {
    includeLanguages: false,
    includeDemographics: false,
    includePublicationDates: false,
  });
});

test("resolveBrowseHydrationExtras requests languages/demos/dates only when needed", () => {
  assert.equal(
    resolveBrowseHydrationExtras({ languages: ["ar"] }).includeLanguages,
    true
  );
  assert.equal(
    resolveBrowseHydrationExtras({ contentLanguages: ["en"] }).includeLanguages,
    true
  );
  assert.equal(
    resolveBrowseHydrationExtras({ audienceGender: "female" }).includeDemographics,
    true
  );
  assert.equal(
    resolveBrowseHydrationExtras({ audienceAgeMin: "25", audienceAgeMax: "34" })
      .includeDemographics,
    true
  );
  assert.equal(
    resolveBrowseHydrationExtras({ lastPostWithin: "30d" }).includePublicationDates,
    true
  );
});

test("filtersToBrowseParams serializes lastPostWithin and minViews", () => {
  const filters: CreatorSearchFilters = {
    ...cloneCreatorSearchFilters(),
    minViews: "10000",
    lastPostWithin: "30d",
  };
  const params = filtersToBrowseParams(filters, 1, 24);
  assert.equal(params.minViews, 10_000);
  assert.equal(params.lastPostWithin, "30d");
  assert.equal("minEstimatedCost" in params, false);
});

// ---------------------------------------------------------------------------
// Language
// ---------------------------------------------------------------------------

test("language OR: creator matches any selected language", () => {
  const creator = makeCreator({
    unified_id: "inf:lang1",
    language_codes: ["ar"],
  });
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(creator, { languages: ["ar", "en"] }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(creator, { languages: ["en", "fr"] }),
    false
  );
});

test("language missing codes do not match when languages selected", () => {
  const creator = makeCreator({
    unified_id: "inf:lang2",
    language_codes: [],
  });
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(creator, { languages: ["ar"] }),
    false
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(creator, { contentLanguages: ["en"] }),
    false
  );
  assert.equal(creatorMatchesDiscoveryBrowseFilters(creator, {}), true);
});

// ---------------------------------------------------------------------------
// Gender / age
// ---------------------------------------------------------------------------

test("gender matching and non-matching", () => {
  const female = makeCreator({
    unified_id: "inf:g1",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 10, "25_34": 55, "35_44": 20, "45_54": 5, "55_plus": 5 },
      gender: { male: 20, female: 78, unknown: 2 },
      topCountries: null,
      topCities: null,
      source: "modash",
    },
  });
  const male = makeCreator({
    unified_id: "inf:g2",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 10, "25_34": 55, "35_44": 20, "45_54": 5, "55_plus": 5 },
      gender: { male: 70, female: 28, unknown: 2 },
      topCountries: null,
      topCities: null,
      source: "modash",
    },
  });
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(female, { audienceGender: "female" }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(male, { audienceGender: "female" }),
    false
  );
});

test("missing demographics do not match gender/age filters", () => {
  const missing = makeCreator({
    unified_id: "inf:g3",
    audience_demographics: null,
  });
  const unavailable = makeCreator({
    unified_id: "inf:g4",
    audience_demographics: {
      age: { "13_17": null, "18_24": null, "25_34": null, "35_44": null, "45_54": null, "55_plus": null },
      gender: { male: null, female: null, unknown: null },
      topCountries: null,
      topCities: null,
      source: "unavailable",
    },
  });
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(missing, { audienceGender: "female" }),
    false
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(unavailable, { audienceGender: "female" }),
    false
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(unavailable, {
      audienceAgeMin: "25",
      audienceAgeMax: "34",
    }),
    false
  );
  assert.equal(creatorMatchesDiscoveryBrowseFilters(missing, {}), true);
});

test("age range matching and outside range", () => {
  const match = makeCreator({
    unified_id: "inf:a1",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 10, "25_34": 55, "35_44": 20, "45_54": 5, "55_plus": 5 },
      gender: { male: 40, female: 60, unknown: 0 },
      topCountries: null,
      topCities: null,
      source: "modash",
    },
  });
  const miss = makeCreator({
    unified_id: "inf:a2",
    audience_demographics: {
      age: { "13_17": 5, "18_24": 55, "25_34": 20, "35_44": 10, "45_54": 5, "55_plus": 5 },
      gender: { male: 40, female: 60, unknown: 0 },
      topCountries: null,
      topCities: null,
      source: "modash",
    },
  });
  const filters = { audienceAgeMin: "25", audienceAgeMax: "34" };
  assert.equal(creatorMatchesDiscoveryBrowseFilters(match, filters), true);
  assert.equal(creatorMatchesDiscoveryBrowseFilters(miss, filters), false);
});

// ---------------------------------------------------------------------------
// Numeric / views
// ---------------------------------------------------------------------------

test("minViews requires avg_views; null never matches", () => {
  const withViews = makeCreator({
    unified_id: "inf:v1",
    metrics: {
      followers: { value: 1000, confidence: "verified" },
      engagement_rate: { value: 1, confidence: "verified" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      avg_views: { value: 25_000, confidence: "verified" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
  });
  const missingViews = makeCreator({ unified_id: "inf:v2" });
  assert.equal(creatorMatchesMinViews(withViews, 10_000), true);
  assert.equal(creatorMatchesMinViews(withViews, 50_000), false);
  assert.equal(creatorMatchesMinViews(missingViews, 1), false);
  assert.equal(creatorMatchesMinViews(missingViews, null), true);
});

// ---------------------------------------------------------------------------
// Last post freshness
// ---------------------------------------------------------------------------

test("last-post uses publication posted_at only; missing dates exclude", () => {
  const now = Date.parse("2026-09-07T00:00:00.000Z");
  const recent = makeCreator({
    unified_id: "inf:p1",
    recent_publications: [
      {
        url: "https://example.com/1",
        thumbnail: null,
        likes: null,
        comments: null,
        views: null,
        posted_at: "2026-09-01T00:00:00.000Z",
        caption: null,
        isVideo: false,
      },
    ],
    last_enriched_at: "2026-09-06T00:00:00.000Z",
  });
  const old = makeCreator({
    unified_id: "inf:p2",
    recent_publications: [
      {
        url: "https://example.com/2",
        thumbnail: null,
        likes: null,
        comments: null,
        views: null,
        posted_at: "2025-01-01T00:00:00.000Z",
        caption: null,
        isVideo: false,
      },
    ],
  });
  const noDate = makeCreator({
    unified_id: "inf:p3",
    recent_publications: [
      {
        url: "https://example.com/3",
        thumbnail: "https://cdn.example/t.jpg",
        likes: null,
        comments: null,
        views: null,
        posted_at: null,
        caption: null,
        isVideo: false,
      },
    ],
    last_enriched_at: "2026-09-06T00:00:00.000Z",
  });
  const noPubs = makeCreator({
    unified_id: "inf:p4",
    recent_publications: [],
    last_enriched_at: "2026-09-06T00:00:00.000Z",
  });

  assert.equal(creatorMatchesLastPostWithin(recent, "30d", now), true);
  assert.equal(creatorMatchesLastPostWithin(old, "30d", now), false);
  assert.equal(creatorMatchesLastPostWithin(noDate, "30d", now), false);
  assert.equal(creatorMatchesLastPostWithin(noPubs, "30d", now), false);
  assert.equal(creatorMatchesLastPostWithin(noPubs, "", now), true);
  assert.equal(latestCanonicalPublicationTimestamp(noDate), null);
});

// ---------------------------------------------------------------------------
// Platforms / countries / categories (OR within, AND across)
// ---------------------------------------------------------------------------

test("platforms OR within; AND with country", () => {
  const igEg = makeCreator({
    unified_id: "inf:pl1",
    country_code: "EG",
    country_codes: ["EG"],
    platforms: [platform("instagram")],
  });
  const ttEg = makeCreator({
    unified_id: "inf:pl2",
    country_code: "EG",
    country_codes: ["EG"],
    platforms: [platform("tiktok")],
  });
  const igAe = makeCreator({
    unified_id: "inf:pl3",
    country_code: "AE",
    country_codes: ["AE"],
    estimated_country: "AE",
    platforms: [platform("instagram")],
  });

  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(igEg, {
      platforms: ["instagram", "tiktok"],
      creatorCountries: ["EG"],
    }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(ttEg, {
      platforms: ["instagram", "tiktok"],
      creatorCountries: ["EG"],
    }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(igAe, {
      platforms: ["instagram", "tiktok"],
      creatorCountries: ["EG"],
    }),
    false
  );
});

test("categories OR within; AND with platform", () => {
  const prIg = makeCreator({
    unified_id: "inf:c1",
    categories: ["PR", "Lifestyle"],
    browse_category_tags: ["PR", "Lifestyle"],
    platforms: [platform("instagram")],
  });
  const beautyTt = makeCreator({
    unified_id: "inf:c2",
    categories: ["Beauty"],
    browse_category_tags: ["Beauty"],
    platforms: [platform("tiktok")],
  });
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(prIg, {
      categories: ["PR", "News"],
      platform: "instagram",
    }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(beautyTt, {
      categories: ["PR", "News"],
      platform: "instagram",
    }),
    false
  );
});

test("multi-country OR semantics", () => {
  const eg = makeCreator({
    unified_id: "inf:co1",
    country_code: "EG",
    country_codes: ["EG"],
  });
  const ae = makeCreator({
    unified_id: "inf:co2",
    country_code: "AE",
    country_codes: ["AE"],
  });
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(eg, { creatorCountries: ["EG", "AE"] }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(ae, { creatorCountries: ["EG", "AE"] }),
    true
  );
  assert.equal(
    creatorMatchesDiscoveryBrowseFilters(eg, { creatorCountries: ["SA"] }),
    false
  );
});

// ---------------------------------------------------------------------------
// Client-only remaining filters + pagination honesty helpers
// ---------------------------------------------------------------------------

test("Phase 0 client-only filters are handle / aiNiche / brandSafety only", () => {
  const base = cloneCreatorSearchFilters();
  assert.equal(hasClientOnlyCreatorSearchFilters(base), false);
  assert.deepEqual(
    listClientOnlyCreatorSearchFilterKeys({
      ...base,
      languages: ["ar", "en"],
      contentLanguages: ["ar"],
      lastPostWithin: "30d",
    }),
    []
  );
  assert.deepEqual(
    listClientOnlyCreatorSearchFilterKeys({
      ...base,
      handle: "ahmed",
      aiNiche: "beauty",
      minBrandSafety: "60",
    }),
    ["handle", "aiNiche", "minBrandSafety"]
  );
});

test("client filters still enforce handle on primary platform only", () => {
  const filters: CreatorSearchFilters = {
    ...DEFAULT_CREATOR_SEARCH_FILTERS,
    handle: "ahmed",
  };
  const match = makeCreator({
    unified_id: "inf:h1",
    platforms: [platform("instagram", "ahmedhassan")],
  });
  const miss = makeCreator({
    unified_id: "inf:h2",
    platforms: [platform("instagram", "sara")],
  });
  assert.equal(applyCreatorSearchClientFilters([match, miss], filters).length, 1);
});
