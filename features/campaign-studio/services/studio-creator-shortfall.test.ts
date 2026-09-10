/**
 * 10 requested, 9 recommended.
 *
 * `composeCreatorSlate` never pads a short slate with a creator whose tier the
 * Strategy did not ask for — it records `tierShortfall` and comes up short. So
 * a one-creator gap is a real supply outcome, and the header now says so
 * instead of leaving the operator to infer it from two stat tiles.
 *
 * A shortfall and a rendering loss look identical on screen, so they are
 * counted apart: identity is the canonical creator id, never a display name or
 * handle.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { creatorGroupingKey } from "./studio-creator-slate-split";
import {
  resolveStudioCreatorShortfall,
  unrenderedCanonicalCreatorIds,
} from "./studio-creator-shortfall";

// ---------------------------------------------------------------------------
// The Kérastase case.

test("10 requested and 9 recommended reads as a one-creator shortfall", () => {
  const shortfall = resolveStudioCreatorShortfall({
    requestedCount: 10,
    recommendedCount: 9,
  });

  assert.equal(shortfall.hasShortfall, true);
  assert.equal(shortfall.shortfall, 1);
  assert.equal(shortfall.requested, 10, "the requested count is preserved, never reduced");
  assert.equal(shortfall.summary, "10 requested · 9 recommended · 1 creator shortfall");
});

test("the requested count is never rewritten to match the slate", () => {
  const shortfall = resolveStudioCreatorShortfall({
    requestedCount: 10,
    recommendedCount: 4,
  });
  assert.equal(shortfall.requested, 10);
  assert.equal(shortfall.shortfall, 6);
  assert.match(shortfall.summary!, /6 creators shortfall/);
});

test("a full slate says nothing", () => {
  const full = resolveStudioCreatorShortfall({ requestedCount: 10, recommendedCount: 10 });
  assert.equal(full.hasShortfall, false);
  assert.equal(full.summary, null);
});

test("more creators than requested is not a shortfall", () => {
  // The operator may add beyond the recommendation — that is allowed.
  const over = resolveStudioCreatorShortfall({ requestedCount: 10, recommendedCount: 12 });
  assert.equal(over.hasShortfall, false);
  assert.equal(over.shortfall, 0);
});

test("no requested quantity means no shortfall claim", () => {
  for (const requestedCount of [null, undefined, 0]) {
    const none = resolveStudioCreatorShortfall({ requestedCount, recommendedCount: 3 });
    assert.equal(none.hasShortfall, false, String(requestedCount));
    assert.equal(none.summary, null);
  }
});

// ---------------------------------------------------------------------------
// A rendering loss is a different thing, and detected by canonical id.

test("every persisted canonical id renders, or it is reported", () => {
  const canonical = ["inf:a", "inf:b", "inf:c", "inf:d", "inf:e"];

  assert.deepEqual(
    unrenderedCanonicalCreatorIds({
      canonicalIds: canonical,
      renderedIds: canonical,
      normalize: creatorGroupingKey,
    }),
    [],
    "a full render loses nothing"
  );

  assert.deepEqual(
    unrenderedCanonicalCreatorIds({
      canonicalIds: canonical,
      renderedIds: ["inf:a", "inf:b", "inf:c", "inf:d"],
      normalize: creatorGroupingKey,
    }),
    ["inf:e"],
    "a dropped creator is named, not silently absorbed into a shortfall"
  );
});

test("id prefixes do not fake a rendering loss", () => {
  // The slate stores `inf:x` and hydration may report `x` or `dis:x` — the same
  // creator. Comparing raw strings would report phantom losses.
  assert.deepEqual(
    unrenderedCanonicalCreatorIds({
      canonicalIds: ["inf:a", "dis:b", "c"],
      renderedIds: ["a", "b", "inf:c"],
      normalize: creatorGroupingKey,
    }),
    []
  );
});

test("a duplicate canonical id is counted once", () => {
  // Two cards for one creator would otherwise mask a missing one.
  assert.deepEqual(
    unrenderedCanonicalCreatorIds({
      canonicalIds: ["inf:a", "inf:a", "inf:b"],
      renderedIds: ["inf:a"],
      normalize: creatorGroupingKey,
    }),
    ["inf:b"]
  );
});

test("identity is the canonical id, never the display name or handle", () => {
  // Two genuinely different creators can share a display name; a name-based
  // check would call one of them a duplicate and lose it.
  const missing = unrenderedCanonicalCreatorIds({
    canonicalIds: ["inf:one", "inf:two"],
    renderedIds: ["inf:one"],
    normalize: creatorGroupingKey,
  });
  assert.deepEqual(missing, ["inf:two"]);

  // And the same creator under two id prefixes is ONE creator.
  assert.equal(creatorGroupingKey("inf:one"), creatorGroupingKey("dis:one"));
  assert.notEqual(creatorGroupingKey("inf:one"), creatorGroupingKey("inf:two"));
});
