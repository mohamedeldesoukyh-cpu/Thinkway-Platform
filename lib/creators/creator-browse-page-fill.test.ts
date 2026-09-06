import assert from "node:assert/strict";
import test from "node:test";

import {
  accumulateCreatorBrowseFillPage,
  CREATOR_BROWSE_FILL_BATCH,
  CREATOR_BROWSE_MAX_FILL_WINDOWS,
  CREATOR_BROWSE_SPARSE_ZERO_MATCH_WINDOW_LIMIT,
  creatorBrowseSparseEarlyStopActive,
  isCreatorBrowseRawWindowExhausted,
  requiresCreatorBrowseCandidateFill,
  resolveCreatorBrowseFillHasMore,
  resolveCreatorBrowseFillMaxWindows,
} from "@/lib/creators/creator-browse-page-fill";
import { BROWSE_PIN_PRIORITY_COUNTRY } from "@/lib/creators/browse-pin-tier";

type Row = { unified_id: string; score?: number };

function row(id: string, score = 0): Row {
  return { unified_id: id, score };
}

test("empty filters never require fill", () => {
  assert.equal(requiresCreatorBrowseCandidateFill({}), false);
  assert.equal(requiresCreatorBrowseCandidateFill({ productionOnly: true }), false);
});

test("server filters that can shrink a page require fill", () => {
  assert.equal(requiresCreatorBrowseCandidateFill({ platform: "instagram" }), true);
  assert.equal(requiresCreatorBrowseCandidateFill({ audienceGender: "female" }), true);
  assert.equal(requiresCreatorBrowseCandidateFill({ lastPostWithin: "30d" }), true);
});

test("sparse early-stop only for gender/age/lastPost", () => {
  assert.equal(creatorBrowseSparseEarlyStopActive({}), false);
  assert.equal(creatorBrowseSparseEarlyStopActive({ platform: "instagram" }), false);
  assert.equal(creatorBrowseSparseEarlyStopActive({ minFollowers: 1000 }), false);
  assert.equal(creatorBrowseSparseEarlyStopActive({ audienceGender: "female" }), true);
  assert.equal(creatorBrowseSparseEarlyStopActive({ audienceAgeMin: "18" }), true);
  assert.equal(creatorBrowseSparseEarlyStopActive({ lastPostWithin: "30d" }), true);
  assert.equal(CREATOR_BROWSE_SPARSE_ZERO_MATCH_WINDOW_LIMIT, 3);
});

test("raw exhaustion ignores hydrated/match counts", () => {
  assert.equal(
    isCreatorBrowseRawWindowExhausted({ rawCandidateCount: 100, batchSize: 100 }),
    false
  );
  assert.equal(
    isCreatorBrowseRawWindowExhausted({ rawCandidateCount: 30, batchSize: 100 }),
    true
  );
  assert.equal(
    isCreatorBrowseRawWindowExhausted({
      rawCandidateCount: 12,
      batchSize: 100,
      rawHasMore: true,
    }),
    false
  );
  assert.equal(
    isCreatorBrowseRawWindowExhausted({
      rawCandidateCount: 100,
      batchSize: 100,
      rawHasMore: false,
    }),
    true
  );
});

test("has_more contract: budget underfill / zero → false; matching beyond page → true", () => {
  assert.equal(
    resolveCreatorBrowseFillHasMore({
      hasMoreMatchingBeyondPage: false,
      rawExhausted: false,
      budgetExhausted: true,
      sparseEarlyStopped: false,
    }),
    false
  );
  assert.equal(
    resolveCreatorBrowseFillHasMore({
      hasMoreMatchingBeyondPage: false,
      rawExhausted: false,
      budgetExhausted: true,
      sparseEarlyStopped: false,
    }),
    false
  );
  assert.equal(
    resolveCreatorBrowseFillHasMore({
      hasMoreMatchingBeyondPage: true,
      rawExhausted: false,
      budgetExhausted: true,
      sparseEarlyStopped: false,
    }),
    true
  );
  assert.equal(
    resolveCreatorBrowseFillHasMore({
      hasMoreMatchingBeyondPage: false,
      rawExhausted: true,
      budgetExhausted: false,
      sparseEarlyStopped: false,
    }),
    false
  );
  assert.equal(
    resolveCreatorBrowseFillHasMore({
      hasMoreMatchingBeyondPage: false,
      rawExhausted: false,
      budgetExhausted: false,
      sparseEarlyStopped: false,
    }),
    true
  );
  assert.equal(
    resolveCreatorBrowseFillHasMore({
      hasMoreMatchingBeyondPage: false,
      rawExhausted: false,
      budgetExhausted: false,
      sparseEarlyStopped: true,
    }),
    false
  );
});

test("HAS_MORE: budget + zero matches → has_more false", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 3,
    fetchWindow: async () => ({
      rawCandidateCount: 100,
      creators: Array.from({ length: 100 }, (_, n) => row(`z-${n}`)),
      rawHasMore: true,
    }),
    applyFilters: () => [],
    sort: (c) => c,
  });
  assert.equal(result.meta.budgetExhausted, true);
  assert.equal(result.creators.length, 0);
  assert.equal(result.has_more, false);
  assert.equal(result.total, 0);
});

test("HAS_MORE: budget + partial page → has_more false", async () => {
  let w = 0;
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 2,
    fetchWindow: async () => {
      w += 1;
      return {
        rawCandidateCount: 100,
        creators: Array.from({ length: 5 }, (_, n) => row(`p${w}-${n}`)),
        rawHasMore: true,
      };
    },
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(result.meta.budgetExhausted, true);
  assert.equal(result.creators.length, 10);
  assert.equal(result.has_more, false);
});

test("HAS_MORE: budget + full page with known extra matches → has_more true", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 1,
    fetchWindow: async () => ({
      rawCandidateCount: 100,
      // 40 matches in one window — page full and extras known in buffer
      creators: Array.from({ length: 40 }, (_, n) => row(`f-${n}`)),
      rawHasMore: true,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  // targetEnd reached after window 1 — not budget exhausted
  assert.equal(result.meta.budgetExhausted, false);
  assert.equal(result.creators.length, 24);
  assert.equal(result.has_more, true);
  assert.ok(result.meta.matchingBeforeSlice > 24);
});

test("HAS_MORE: targetEnd reached with exactly 24 and raw remains → has_more true", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 2,
    fetchWindow: async (i) => ({
      rawCandidateCount: 100,
      creators: Array.from({ length: 12 }, (_, n) => row(`e${i}-${n}`)),
      rawHasMore: true,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(result.creators.length, 24);
  assert.equal(result.meta.budgetExhausted, false);
  assert.equal(result.meta.matchingBeforeSlice, 24);
  // No matching beyond page; raw not exhausted → has_more true (can continue productively)
  assert.equal(result.has_more, true);
});

test("HAS_MORE: page 2 budget stop underfilled → false", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 2,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 2,
    fetchWindow: async (i) => ({
      rawCandidateCount: 100,
      creators: Array.from({ length: 10 }, (_, n) => row(`pg2-${i}-${n}`)),
      rawHasMore: true,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(result.meta.targetEnd, 48);
  assert.equal(result.meta.budgetExhausted, true);
  assert.equal(result.creators.length, 0); // only 20 matches, offset 24
  assert.equal(result.has_more, false);
});

test("HAS_MORE: raw exhausted + partial → false, exact total", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 5,
    fetchWindow: async () => ({
      rawCandidateCount: 30,
      creators: Array.from({ length: 10 }, (_, n) => row(`r-${n}`)),
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(result.meta.rawExhausted, true);
  assert.equal(result.has_more, false);
  assert.equal(result.total, 10);
});

test("HAS_MORE: raw exhausted + full page → false when no extras", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 5,
    fetchWindow: async () => ({
      rawCandidateCount: 24,
      creators: Array.from({ length: 24 }, (_, n) => row(`full-${n}`)),
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(result.meta.rawExhausted, true);
  assert.equal(result.creators.length, 24);
  assert.equal(result.has_more, false);
  assert.equal(result.total, 24);
});

test("BASIC: raw 24→12 matches fetches next window", async () => {
  let windows = 0;
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 24,
    maxWindows: 5,
    fetchWindow: async (i) => {
      windows += 1;
      if (i === 1) {
        return {
          rawCandidateCount: 24,
          creators: Array.from({ length: 12 }, (_, n) => row(`a-${n}`)),
        };
      }
      return {
        rawCandidateCount: 24,
        creators: Array.from({ length: 24 }, (_, n) => row(`b-${n}`)),
      };
    },
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.ok(windows >= 2);
  assert.equal(result.creators.length, 24);
});

test("PAGE: page1/2/3 targets and slices", async () => {
  const pool = Array.from({ length: 90 }, (_, n) => row(`p-${n}`, 90 - n));
  const fetchWindow = async (i: number) => {
    const start = (i - 1) * 100;
    const slice = pool.slice(start, start + 100);
    return {
      rawCandidateCount: slice.length || 0,
      creators: slice,
      rawHasMore: start + 100 < pool.length,
    };
  };
  const sort = (c: Row[]) => [...c].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const p1 = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 5,
    fetchWindow,
    applyFilters: (c) => c,
    sort,
  });
  assert.equal(p1.meta.targetEnd, 24);
  assert.deepEqual(
    p1.creators.map((c) => c.unified_id),
    pool.slice(0, 24).map((c) => c.unified_id)
  );

  const p2 = await accumulateCreatorBrowseFillPage({
    page: 2,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 5,
    fetchWindow,
    applyFilters: (c) => c,
    sort,
  });
  assert.equal(p2.meta.targetEnd, 48);
  assert.deepEqual(
    p2.creators.map((c) => c.unified_id),
    pool.slice(24, 48).map((c) => c.unified_id)
  );

  const p3 = await accumulateCreatorBrowseFillPage({
    page: 3,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 5,
    fetchWindow,
    applyFilters: (c) => c,
    sort,
  });
  assert.equal(p3.meta.targetEnd, 72);
  assert.deepEqual(
    p3.creators.map((c) => c.unified_id),
    pool.slice(48, 72).map((c) => c.unified_id)
  );
});

test("SPARSE: consecutive zero-match windows trigger early stop", async () => {
  let windows = 0;
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 12,
    sparseZeroMatchWindowLimit: 3,
    fetchWindow: async () => {
      windows += 1;
      return {
        rawCandidateCount: 100,
        creators: Array.from({ length: 100 }, (_, n) => row(`s-${windows}-${n}`)),
        rawHasMore: true,
      };
    },
    applyFilters: () => [],
    sort: (c) => c,
  });
  assert.equal(windows, 3);
  assert.equal(result.meta.sparseEarlyStopped, true);
  assert.equal(result.meta.budgetExhausted, false);
  assert.equal(result.has_more, false);
  assert.equal(result.creators.length, 0);
});

test("SPARSE: one zero-match window does not immediately stop", async () => {
  let windows = 0;
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 12,
    sparseZeroMatchWindowLimit: 3,
    fetchWindow: async (i) => {
      windows += 1;
      if (i === 1) {
        return { rawCandidateCount: 100, creators: [], rawHasMore: true };
      }
      return {
        rawCandidateCount: 100,
        creators: Array.from({ length: 40 }, (_, n) => row(`ok-${n}`)),
        rawHasMore: true,
      };
    },
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.ok(windows >= 2);
  assert.equal(result.meta.sparseEarlyStopped, false);
  assert.equal(result.creators.length, 24);
});

test("SPARSE: targetEnd reached stops normally without sparse flag", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 12,
    sparseZeroMatchWindowLimit: 3,
    fetchWindow: async () => ({
      rawCandidateCount: 100,
      creators: Array.from({ length: 50 }, (_, n) => row(`t-${n}`)),
      rawHasMore: true,
    }),
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(result.meta.windowsFetched, 1);
  assert.equal(result.meta.sparseEarlyStopped, false);
  assert.equal(result.creators.length, 24);
});

test("SPARSE: dense filters omit sparse limit — can burn more windows", async () => {
  let windows = 0;
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 5,
    sparseZeroMatchWindowLimit: null,
    fetchWindow: async () => {
      windows += 1;
      return {
        rawCandidateCount: 100,
        creators: Array.from({ length: 2 }, (_, n) => row(`d${windows}-${n}`)),
        rawHasMore: true,
      };
    },
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(windows, 5);
  assert.equal(result.meta.sparseEarlyStopped, false);
  assert.equal(result.meta.budgetExhausted, true);
  assert.equal(result.has_more, false);
});

test("CORRECTNESS: maxFillWindows hard cap; no infinite loop", async () => {
  let windows = 0;
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 100,
    maxWindows: 3,
    fetchWindow: async () => {
      windows += 1;
      assert.ok(windows <= CREATOR_BROWSE_MAX_FILL_WINDOWS);
      return {
        rawCandidateCount: 100,
        creators: Array.from({ length: 2 }, (_, n) => row(`b${windows}-${n}`)),
        rawHasMore: true,
      };
    },
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.equal(windows, 3);
  assert.equal(result.meta.budgetExhausted, true);
  assert.equal(result.has_more, false);
});

test("CORRECTNESS: hydrated count must not determine raw exhaustion", async () => {
  let windows = 0;
  await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 24,
    batchSize: 80,
    maxWindows: 4,
    fetchWindow: async (i) => {
      windows += 1;
      if (i === 1) {
        return {
          rawCandidateCount: 80,
          creators: Array.from({ length: 5 }, (_, n) => row(`h-${n}`)),
          rawHasMore: true,
        };
      }
      return {
        rawCandidateCount: 80,
        creators: Array.from({ length: 40 }, (_, n) => row(`n-${n}`)),
        rawHasMore: true,
      };
    },
    applyFilters: (c) => c,
    sort: (c) => c,
  });
  assert.ok(windows >= 2);
});

test("CORRECTNESS: no duplicate unified_id across windows", async () => {
  const result = await accumulateCreatorBrowseFillPage({
    page: 1,
    pageSize: 10,
    batchSize: 5,
    maxWindows: 5,
    fetchWindow: async (i) => ({
      rawCandidateCount: 5,
      creators: [row("dup"), row(`w${i}-a`), row(`w${i}-b`), row("dup"), row(`w${i}-c`)],
      rawHasMore: i < 3,
    }),
    applyFilters: (c) => c,
    sort: (c) => [...c].sort((a, b) => a.unified_id.localeCompare(b.unified_id)),
  });
  const ids = result.creators.map((c) => c.unified_id);
  assert.equal(new Set(ids).size, ids.length);
});

test("source: Egypt pin restored on filtered fill; unfiltered unchanged", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-browse.ts"),
    "utf8"
  );
  assert.match(source, /requiresCreatorBrowseCandidateFill\(filters\)/);
  assert.match(source, /browseFilteredFastFillPage/);
  assert.match(source, /pinEgyptOnFirstWindow/);
  assert.match(source, new RegExp(`country: BROWSE_PIN_PRIORITY_COUNTRY`));
  assert.match(source, /fast_unfiltered_browse/);
  assert.match(source, /creatorBrowseSparseEarlyStopActive/);
  assert.ok(
    source.indexOf("requiresCreatorBrowseCandidateFill") <
      source.indexOf('perf?.span("fast_unfiltered_browse")')
  );
  // Egypt pin constant still used by unfiltered path
  assert.match(source, new RegExp(BROWSE_PIN_PRIORITY_COUNTRY));
  // Explicit country disables pin via resolveBrowseCreatorCountryCodes length check
  assert.match(source, /resolveBrowseCreatorCountryCodes\(filters\)\.length === 0/);
});

test("max fill windows hard-capped at 12", () => {
  assert.equal(resolveCreatorBrowseFillMaxWindows(1_000_000), CREATOR_BROWSE_MAX_FILL_WINDOWS);
  assert.equal(CREATOR_BROWSE_FILL_BATCH, 100);
});
