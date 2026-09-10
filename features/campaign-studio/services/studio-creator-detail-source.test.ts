/**
 * The Studio creator detail resolves to Discovery's view, or says why not.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  discoveryDetailStateForSource,
  resolveStudioCreatorDetailSource,
} from "./studio-creator-detail-source";

test("a resolved unified creator renders Discovery's own detail sheet", () => {
  assert.equal(
    resolveStudioCreatorDetailSource({
      open: true,
      creatorId: "inf:c1",
      unifiedCreatorResolved: true,
      resolving: false,
    }),
    "discovery_detail"
  );
  assert.equal(discoveryDetailStateForSource("discovery_detail"), undefined);
});

test("while the lookup runs the operator is told it is loading, not that it is missing", () => {
  const source = resolveStudioCreatorDetailSource({
    open: true,
    creatorId: "dis:c9",
    unifiedCreatorResolved: false,
    resolving: true,
  });
  assert.equal(source, "resolving");
  assert.equal(discoveryDetailStateForSource(source), "resolving");
});

test("a creator with no unified record shows the unavailable state, not fabricated data", () => {
  const source = resolveStudioCreatorDetailSource({
    open: true,
    creatorId: "inf:just-added-by-url",
    unifiedCreatorResolved: false,
    resolving: false,
  });
  assert.equal(source, "planning_fallback");
  assert.equal(discoveryDetailStateForSource(source), "unavailable");
});

test("a selection with no id can never claim a Discovery profile", () => {
  for (const creatorId of [undefined, null, "", "   "]) {
    assert.equal(
      resolveStudioCreatorDetailSource({
        open: true,
        creatorId,
        unifiedCreatorResolved: false,
        resolving: true,
      }),
      "planning_fallback",
      "with no id there is nothing to resolve, so nothing is pending"
    );
  }
});

test("a resolved creator stays on Discovery's sheet even after it closes", () => {
  // The sheet keeps its own mount across close so the tabs and loaded detail
  // are not thrown away and refetched on the next open.
  assert.equal(
    resolveStudioCreatorDetailSource({
      open: false,
      creatorId: "inf:c1",
      unifiedCreatorResolved: true,
      resolving: false,
    }),
    "discovery_detail"
  );
});

test("closed with nothing resolved parks on the fallback, never on a spinner", () => {
  assert.equal(
    resolveStudioCreatorDetailSource({
      open: false,
      creatorId: "inf:c1",
      unifiedCreatorResolved: false,
      resolving: true,
    }),
    "planning_fallback"
  );
});
