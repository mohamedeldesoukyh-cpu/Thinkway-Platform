/**
 * Selected vs remaining recommendations, derived — not persisted.
 *
 * A 10-creator pool with a 5-creator slate is the case in the brief. Both id
 * sets are already on the campaign object (`recommendations.creatorIds` and
 * `discovery.creatorIds`, both read by `resolveCreatorCounts`), so the
 * remaining five need no new column and no new section field.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  creatorIdsToHydrate,
  splitRecommendedCreatorIds,
} from "./studio-creator-slate-split";

/** 10 recommended, 5 selected — the verification campaign. */
const POOL = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"];
const SLATE = ["c1", "c2", "c3", "c4", "c5"];

test("10 recommended / 5 selected is derived from existing persisted ids", () => {
  const split = splitRecommendedCreatorIds({
    recommendationIds: SLATE,
    discoveryIds: POOL,
  });

  assert.equal(split.selectedCount, 5);
  assert.equal(split.candidatePoolCount, 10);
  assert.deepEqual(split.selectedIds, SLATE);
  assert.deepEqual(split.remainingIds, ["c6", "c7", "c8", "c9", "c10"]);
});

test("the remaining creators keep pool order and are never dropped", () => {
  const split = splitRecommendedCreatorIds({
    recommendationIds: ["c3", "c1"],
    discoveryIds: POOL,
  });

  assert.deepEqual(split.selectedIds, ["c3", "c1"], "the slate keeps its own order");
  assert.deepEqual(
    split.remainingIds,
    ["c2", "c4", "c5", "c6", "c7", "c8", "c9", "c10"],
    "everything not selected stays available as a candidate"
  );
  assert.equal(split.candidatePoolCount, 10);
});

test("id prefixes cannot double-count a creator into both groups", () => {
  const split = splitRecommendedCreatorIds({
    recommendationIds: ["inf:c1", "c2"],
    discoveryIds: ["c1", "dis:c2", "c3"],
  });

  assert.deepEqual(split.selectedIds, ["inf:c1", "c2"]);
  assert.deepEqual(split.remainingIds, ["c3"], "c1 and c2 are already selected");
  assert.equal(split.candidatePoolCount, 3);
});

test("a creator the operator removed is not offered back", () => {
  const split = splitRecommendedCreatorIds({
    recommendationIds: SLATE,
    discoveryIds: POOL,
    excludeIds: ["c7", "inf:c9"],
  });

  assert.deepEqual(split.remainingIds, ["c6", "c8", "c10"]);
  assert.equal(split.candidatePoolCount, 8);
  assert.equal(split.selectedCount, 5, "removing a candidate never touches the slate");
});

test("a slate with no pool still renders — remaining is simply empty", () => {
  const split = splitRecommendedCreatorIds({
    recommendationIds: SLATE,
    discoveryIds: [],
  });

  assert.deepEqual(split.selectedIds, SLATE);
  assert.deepEqual(split.remainingIds, []);
  assert.equal(
    split.candidatePoolCount,
    5,
    "with no pool the candidate count is the slate itself — never a fabricated total"
  );
});

test("a pool with no slate yet offers nothing as a replacement candidate", () => {
  // Discovery has run, the slate has not been composed. Every creator is a
  // pool member; none is selected, so none is a *replacement* for anything.
  const split = splitRecommendedCreatorIds({
    recommendationIds: [],
    discoveryIds: POOL,
  });

  assert.equal(split.selectedCount, 0);
  assert.deepEqual(split.remainingIds, POOL);
  assert.equal(split.candidatePoolCount, 10);
});

test("both groups hydrate through one id list, so hydration runs once", () => {
  const split = splitRecommendedCreatorIds({
    recommendationIds: SLATE,
    discoveryIds: POOL,
  });
  const ids = creatorIdsToHydrate(split);

  assert.deepEqual(ids, [...SLATE, "c6", "c7", "c8", "c9", "c10"]);
  assert.equal(new Set(ids).size, ids.length, "no id is hydrated twice");
  assert.deepEqual(
    ids.slice(0, split.selectedCount),
    split.selectedIds,
    "the slate leads the list so the selected cards hydrate in the first wave"
  );
});
