/**
 * Phase 1B-2 — FTS + category page-fill contracts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

import {
  accumulateCreatorBrowseFillPage,
  CREATOR_BROWSE_FILL_BATCH,
  CREATOR_BROWSE_MAX_FILL_WINDOWS,
  CREATOR_BROWSE_SPARSE_ZERO_MATCH_WINDOW_LIMIT,
  creatorBrowseFtsStructuredShrinkActive,
  creatorBrowseSparseEarlyStopActive,
  resolveCreatorBrowseFtsFillTotal,
} from "@/lib/creators/creator-browse-page-fill";

type Ranked = { unified_id: string; search_rank: number; platform?: string };

function ranked(id: string, rank: number, platform = "instagram"): Ranked {
  return { unified_id: id, search_rank: rank, platform };
}

test("bare q is not structured shrink; platform/country/metrics/lang/gender/category are", () => {
  assert.equal(creatorBrowseFtsStructuredShrinkActive({}), false);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ productionOnly: true }), false);
  assert.equal(
    creatorBrowseFtsStructuredShrinkActive({ search: "beauty", productionOnly: true }),
    false
  );
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ platform: "instagram" }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ country: "EG" }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ minFollowers: 1000 }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ minEngagement: 1 }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ minViews: 500 }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ language: "ar" }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ languages: ["ar"] }), true);
  assert.equal(
    creatorBrowseFtsStructuredShrinkActive({ contentLanguages: ["en"] }),
    true
  );
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ audienceGender: "female" }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ lastPostWithin: "30d" }), true);
  assert.equal(creatorBrowseFtsStructuredShrinkActive({ categories: ["Beauty"] }), true);
});

test("FTS total: bare q may retain raw total_count; structured uses fill total", () => {
  assert.equal(
    resolveCreatorBrowseFtsFillTotal({
      structuredShrink: false,
      fillTotal: 25,
      rawFtsTotalCount: 480,
      pageCreatorsLength: 24,
    }),
    480
  );
  assert.equal(
    resolveCreatorBrowseFtsFillTotal({
      structuredShrink: true,
      fillTotal: 25,
      rawFtsTotalCount: 480,
      pageCreatorsLength: 24,
    }),
    25
  );
  assert.equal(
    resolveCreatorBrowseFtsFillTotal({
      structuredShrink: false,
      fillTotal: 10,
      rawFtsTotalCount: null,
      pageCreatorsLength: 10,
    }),
    10
  );
});

test("FTS-like fill: page 1 / page 2 are matching slices; rank preserved across windows", async () => {
  const universe: Ranked[] = [];
  for (let i = 0; i < 250; i++) {
    universe.push(ranked(`c${i}`, 1000 - i));
  }

  const fetchWindow = async (windowIndex: number) => {
    const start = (windowIndex - 1) * CREATOR_BROWSE_FILL_BATCH;
    const slice = universe.slice(start, start + CREATOR_BROWSE_FILL_BATCH);
    return {
      creators: slice,
      rawCandidateCount: slice.length,
      rawHasMore: start + slice.length < universe.length,
    };
  };

  const sortByRank = (creators: Ranked[]) =>
    [...creators].sort(
      (a, b) => b.search_rank - a.search_rank || a.unified_id.localeCompare(b.unified_id)
    );

  const p1 = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow,
    applyFilters: (c) => c,
    sort: sortByRank,
  });
  assert.equal(p1.creators.length, 24);
  assert.deepEqual(
    p1.creators.map((c) => c.unified_id),
    universe.slice(0, 24).map((c) => c.unified_id)
  );
  assert.equal(p1.has_more, true);
  assert.ok(p1.meta.windowsFetched === 1);

  const p2 = await accumulateCreatorBrowseFillPage({
    page: 2,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow,
    applyFilters: (c) => c,
    sort: sortByRank,
  });
  assert.equal(p2.creators.length, 24);
  assert.deepEqual(
    p2.creators.map((c) => c.unified_id),
    universe.slice(24, 48).map((c) => c.unified_id)
  );
  assert.ok(p1.creators[0]!.search_rank >= p1.creators[23]!.search_rank);
  assert.ok(p2.creators[0]!.search_rank < p1.creators[23]!.search_rank);
});

test("FTS-like fill with platform shrink: page 2 is matches 24–48 not raw window 2", async () => {
  const fetchWindow = async (windowIndex: number) => {
    const creators: Ranked[] = [];
    for (let i = 0; i < CREATOR_BROWSE_FILL_BATCH; i++) {
      const id = (windowIndex - 1) * CREATOR_BROWSE_FILL_BATCH + i;
      // Every 4th row matches platform filter.
      creators.push(
        ranked(`r${id}`, 5000 - id, id % 4 === 0 ? "instagram" : "tiktok")
      );
    }
    return {
      creators,
      rawCandidateCount: CREATOR_BROWSE_FILL_BATCH,
      rawHasMore: windowIndex < 6,
    };
  };

  const applyFilters = (creators: Ranked[]) =>
    creators.filter((c) => c.platform === "instagram");
  const sortByRank = (creators: Ranked[]) =>
    [...creators].sort((a, b) => b.search_rank - a.search_rank);

  const p1 = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow,
    applyFilters,
    sort: sortByRank,
  });
  const p2 = await accumulateCreatorBrowseFillPage({
    page: 2,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow,
    applyFilters,
    sort: sortByRank,
  });

  assert.equal(p1.creators.length, 24);
  assert.equal(p2.creators.length, 24);
  // Matching IG ids are r0,r4,..., spaced by 4 — page2 starts at match index 24 → r96
  assert.equal(p1.creators[0]!.unified_id, "r0");
  assert.equal(p1.creators[23]!.unified_id, "r92");
  assert.equal(p2.creators[0]!.unified_id, "r96");
  assert.equal(p2.creators[23]!.unified_id, "r188");
  assert.equal(p1.meta.windowsFetched >= 1, true);
  assert.ok(p2.meta.windowsFetched >= 2);
});

test("category-like fill preserves first-seen RPC order across page 2", async () => {
  const fetchWindow = async (windowIndex: number) => {
    const creators = [];
    for (let i = 0; i < CREATOR_BROWSE_FILL_BATCH; i++) {
      const id = (windowIndex - 1) * CREATOR_BROWSE_FILL_BATCH + i;
      creators.push({ unified_id: `cat-${id}`, keep: id % 3 !== 0 });
    }
    return {
      creators,
      rawCandidateCount: CREATOR_BROWSE_FILL_BATCH,
      rawHasMore: windowIndex < 5,
    };
  };

  const p2 = await accumulateCreatorBrowseFillPage({
    page: 2,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow,
    applyFilters: (c) => c.filter((row) => row.keep),
    sort: (c) => c,
  });

  assert.equal(p2.creators.length, 24);
  // Keep ids: 1,2,4,5,7,... — match index 24 is the 25th keeper.
  const keepers: string[] = [];
  for (let id = 0; keepers.length < 48; id++) {
    if (id % 3 !== 0) keepers.push(`cat-${id}`);
  }
  assert.deepEqual(
    p2.creators.map((c) => c.unified_id),
    keepers.slice(24, 48)
  );
});

test("sparse early-stop has_more false; budget underfill has_more false", async () => {
  assert.equal(creatorBrowseSparseEarlyStopActive({ audienceGender: "female" }), true);
  assert.equal(CREATOR_BROWSE_SPARSE_ZERO_MATCH_WINDOW_LIMIT, 3);

  const sparse = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    sparseZeroMatchWindowLimit: CREATOR_BROWSE_SPARSE_ZERO_MATCH_WINDOW_LIMIT,
    fetchWindow: async () => ({
      creators: Array.from({ length: CREATOR_BROWSE_FILL_BATCH }, (_, i) => ({
        unified_id: `z${i}`,
      })),
      rawCandidateCount: CREATOR_BROWSE_FILL_BATCH,
      rawHasMore: true,
    }),
    applyFilters: () => [],
    sort: (c) => c,
  });
  assert.equal(sparse.meta.sparseEarlyStopped, true);
  assert.equal(sparse.has_more, false);
  assert.equal(sparse.total, 0);
  assert.equal(sparse.meta.windowsFetched, 3);

  const budget = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: 2,
    fetchWindow: async (windowIndex) => ({
      creators: [{ unified_id: `only-${windowIndex}` }],
      rawCandidateCount: CREATOR_BROWSE_FILL_BATCH,
      rawHasMore: true,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(budget.meta.budgetExhausted, true);
  assert.equal(budget.has_more, false);
  assert.equal(budget.creators.length, 2);
  assert.equal(budget.total, 2);
});

test("raw exhausted → exact total; remaining raw with full page → lower-bound total", async () => {
  const exact = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow: async () => ({
      creators: Array.from({ length: 10 }, (_, i) => ({ unified_id: `e${i}` })),
      rawCandidateCount: 10,
      rawHasMore: false,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(exact.meta.rawExhausted, true);
  assert.equal(exact.total, 10);
  assert.equal(exact.has_more, false);

  const lower = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: CREATOR_BROWSE_FILL_BATCH,
    maxWindows: CREATOR_BROWSE_MAX_FILL_WINDOWS,
    fetchWindow: async () => ({
      creators: Array.from({ length: CREATOR_BROWSE_FILL_BATCH }, (_, i) => ({
        unified_id: `m${i}`,
      })),
      rawCandidateCount: CREATOR_BROWSE_FILL_BATCH,
      rawHasMore: true,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(lower.creators.length, 24);
  assert.equal(lower.has_more, true);
  assert.equal(lower.meta.rawExhausted, false);
  assert.ok(lower.total >= 25);
});

test("source wiring: FTS + category always fill; audience/unfiltered/filtered-fast preserved", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-browse.ts"),
    "utf8"
  );
  assert.match(source, /async function browseFtsFillPage/);
  assert.match(source, /async function browseCategoryFillPage/);
  assert.match(source, /accumulateCreatorBrowseFillPage/);
  assert.match(source, /fts_browse_fill/);
  assert.match(source, /category_browse_fill/);
  assert.match(source, /5c_fts_fill/);
  assert.match(source, /5c_category_fill/);
  assert.match(source, /allowHandleFallback/);
  assert.match(source, /usedHandleFallback/);
  assert.match(source, /creatorBrowseFtsStructuredShrinkActive/);
  assert.match(source, /resolveCreatorBrowseFtsFillTotal/);
  // Category fill must not Egypt-pin candidate windows.
  const categoryFnStart = source.indexOf("async function browseCategoryFillPage");
  const categoryFnEnd = source.indexOf(
    "/** Prefer platform account photo",
    categoryFnStart
  );
  assert.ok(categoryFnStart > 0 && categoryFnEnd > categoryFnStart);
  const categoryFn = source.slice(categoryFnStart, categoryFnEnd);
  assert.doesNotMatch(categoryFn, /BROWSE_PIN_PRIORITY_COUNTRY/);
  assert.doesNotMatch(categoryFn, /pinEgypt/);
  // Multi-filter Production timeout: no pre-count RPC; metrics early-stop; LIMIT+1 has_more.
  assert.doesNotMatch(categoryFn, /countInternalCreatorsBrowse/);
  assert.doesNotMatch(categoryFn, /resolveCreatorBrowseFillMaxWindows/);
  assert.match(categoryFn, /CREATOR_BROWSE_MAX_FILL_WINDOWS/);
  assert.match(categoryFn, /browseCandidateQualificationActive/);
  assert.match(categoryFn, /browse\.hasMore/);
  // Regressions: prior paths still present and ordered correctly.
  assert.match(source, /browseFilteredFastFillPage/);
  assert.match(source, /browseDiscoveryAudienceFilteredPage/);
  assert.match(source, /requiresDiscoveryAudienceScanPath\(filters\)/);
  assert.match(source, /fast_unfiltered_browse/);
  assert.ok(
    source.indexOf("requiresDiscoveryAudienceScanPath(filters)") <
      source.indexOf('perf?.span("category_browse_fill")')
  );
  assert.ok(
    source.indexOf('perf?.span("category_browse_fill")') <
      source.indexOf('perf?.span("filtered_fast_browse_fill")')
  );
  assert.ok(
    source.indexOf('perf?.span("filtered_fast_browse_fill")') <
      source.indexOf('perf?.span("fast_unfiltered_browse")')
  );
  assert.ok(
    source.indexOf('perf?.span("fts_browse_fill")') >
      source.indexOf('perf?.span("fast_unfiltered_browse")')
  );
});
