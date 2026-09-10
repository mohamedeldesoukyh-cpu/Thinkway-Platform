/**
 * Loading must never look like "Discovery returned nothing".
 *
 * The section chose between cards and its empty state on `vendors.length === 0`
 * plus a hydration flag that read false on the render where the slate had just
 * changed — so for the width of the hydration waves the operator saw the
 * run-discovery / no-results area with creator ids already persisted.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveStudioCreatorListState,
  studioCreatorListIsLoading,
} from "./studio-creator-list-state";

const IDLE = {
  expectedCreatorIdCount: 0,
  hydratedCount: 0,
  searching: false,
  hydrationLoading: false,
  hasSearched: false,
  proposalBlocked: false,
};

test("nothing searched yet is ready to run", () => {
  assert.equal(resolveStudioCreatorListState(IDLE), "ready_to_run");
});

test("a search in flight is searching", () => {
  assert.equal(
    resolveStudioCreatorListState({ ...IDLE, searching: true }),
    "searching"
  );
});

test("ids persisted with nothing hydrated is loading, never zero results", () => {
  const state = resolveStudioCreatorListState({
    ...IDLE,
    expectedCreatorIdCount: 10,
    hydratedCount: 0,
    hasSearched: true,
  });

  assert.equal(state, "hydrating");
  assert.equal(studioCreatorListIsLoading(state), true);
});

test("the stale-flag case: ids exist, hydration reports not-loading, still loading", () => {
  // This is the exact regression — the hook's `loading` was false on the render
  // after the slate changed, while its vendor state had already been emptied.
  const state = resolveStudioCreatorListState({
    ...IDLE,
    expectedCreatorIdCount: 10,
    hydratedCount: 0,
    hydrationLoading: false,
    hasSearched: true,
  });

  assert.equal(state, "hydrating");
  assert.notEqual(state, "no_results");
});

test("hydrated creators are results", () => {
  const state = resolveStudioCreatorListState({
    ...IDLE,
    expectedCreatorIdCount: 10,
    hydratedCount: 4,
    hydrationLoading: true,
    hasSearched: true,
  });

  assert.equal(state, "results", "partial hydration still shows the cards it has");
  assert.equal(studioCreatorListIsLoading(state), false);
});

test("a completed search with no ids is a real zero result", () => {
  const state = resolveStudioCreatorListState({ ...IDLE, hasSearched: true });
  assert.equal(state, "no_results");
  assert.equal(studioCreatorListIsLoading(state), false);
});

test("a blocked proposal is reported as blocked, not as zero results", () => {
  assert.equal(
    resolveStudioCreatorListState({ ...IDLE, proposalBlocked: true, hasSearched: true }),
    "blocked"
  );
});

test("searching outranks a previous zero result", () => {
  assert.equal(
    resolveStudioCreatorListState({ ...IDLE, hasSearched: true, searching: true }),
    "searching"
  );
});
