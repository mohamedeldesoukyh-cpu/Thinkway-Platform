import assert from "node:assert/strict";
import test from "node:test";

import {
  creatorMatchesRemoval,
  selectCreatorsToAdd,
  tierFollowerRange,
} from "./slate-edit-filters";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

function mockCreator(overrides: Partial<UnifiedCreatorResult> = {}): UnifiedCreatorResult {
  return {
    unified_id: "inf:test",
    display_name: "Test Creator",
    handle: "@test",
    platforms: [],
    metrics: {
      followers: { value: 100_000, confidence: "estimated" },
      engagement_rate: { value: 3, confidence: "estimated" },
    },
    ...overrides,
  } as UnifiedCreatorResult;
}

test("tierFollowerRange gives non-overlapping bands", () => {
  assert.deepEqual(tierFollowerRange("Macro"), { minFollowers: 500_000, maxFollowers: 999_999 });
  assert.deepEqual(tierFollowerRange("Mega"), { minFollowers: 1_000_000, maxFollowers: 4_999_999 });
  assert.deepEqual(tierFollowerRange("Micro"), { minFollowers: 10_000, maxFollowers: 99_999 });
  assert.deepEqual(tierFollowerRange("Celebrity"), { minFollowers: 5_000_000 });
  assert.deepEqual(tierFollowerRange("Nano"), { minFollowers: 1_000, maxFollowers: 9_999 });
  assert.deepEqual(tierFollowerRange("Mid"), { minFollowers: 100_000, maxFollowers: 499_999 });
});

test("creatorMatchesRemoval by city and engagement", () => {
  const creator = mockCreator({
    city: "Cairo",
    metrics: {
      followers: { value: 50_000, confidence: "estimated" },
      engagement_rate: { value: 1.5, confidence: "estimated" },
    } as UnifiedCreatorResult["metrics"],
  });
  assert.equal(creatorMatchesRemoval(creator, { city: "Cairo" }), true);
  assert.equal(creatorMatchesRemoval(creator, { belowEngagement: 2 }), true);
  assert.equal(creatorMatchesRemoval(creator, { belowEngagement: 1 }), false);
});

test("selectCreatorsToAdd respects count and dedupes", () => {
  const candidates = [
    mockCreator({ unified_id: "inf:a" }),
    mockCreator({ unified_id: "inf:b" }),
    mockCreator({ unified_id: "inf:c" }),
  ];
  const existing = new Set(["a"]);
  const picked = selectCreatorsToAdd(candidates, existing, 2);
  assert.equal(picked.length, 2);
  assert.equal(picked[0]?.unified_id, "inf:b");
});
