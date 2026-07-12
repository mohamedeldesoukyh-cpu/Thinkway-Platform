import assert from "node:assert/strict";
import test from "node:test";

import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";

import {
  creatorEngagementRate,
  selectCreatorsToAdd,
  selectSlateCreatorsToRemove,
  tierFollowerRange,
} from "./slate-edit-filters";

function creator(
  id: string,
  opts: { city?: string; country?: string; er?: number; followers?: number } = {}
): UnifiedCreatorResult {
  return {
    unified_id: id,
    display_name: id,
    city: opts.city ?? null,
    country_code: opts.country ?? null,
    estimated_country: null,
    metrics: {
      followers: { value: opts.followers ?? 100_000, confidence: "high" },
      engagement_rate: { value: opts.er ?? null, confidence: "high" },
    },
    platforms: [],
  } as unknown as UnifiedCreatorResult;
}

test("tierFollowerRange gives non-overlapping bands", () => {
  assert.deepEqual(tierFollowerRange("Macro"), { minFollowers: 1_000_000, maxFollowers: 4_999_999 });
  assert.deepEqual(tierFollowerRange("Micro"), { minFollowers: 10_000, maxFollowers: 49_999 });
  assert.deepEqual(tierFollowerRange("Celebrity"), { minFollowers: 5_000_000 });
  assert.deepEqual(tierFollowerRange("Nano"), { maxFollowers: 9_999 });
});

test("selectSlateCreatorsToRemove matches by city (case/substring insensitive)", () => {
  const slate = [
    creator("a", { city: "Cairo" }),
    creator("b", { city: "Alexandria" }),
    creator("c", { city: "cairo, egypt" }),
  ];
  const removed = selectSlateCreatorsToRemove(slate, { city: "Cairo" });
  assert.deepEqual(removed.map((c) => c.unified_id).sort(), ["a", "c"]);
});

test("selectSlateCreatorsToRemove matches creators below an engagement threshold", () => {
  const slate = [
    creator("a", { er: 2 }),
    creator("b", { er: 9 }),
    creator("c", { er: null as unknown as number }),
  ];
  const removed = selectSlateCreatorsToRemove(slate, { belowEngagement: 5 });
  assert.deepEqual(removed.map((c) => c.unified_id), ["a"]);
});

test("selectSlateCreatorsToRemove with no criteria removes nothing", () => {
  const slate = [creator("a", { city: "Cairo" })];
  assert.equal(selectSlateCreatorsToRemove(slate, {}).length, 0);
});

test("selectCreatorsToAdd excludes existing slate ids and caps at count", () => {
  const candidates = [
    creator("inf:x"),
    creator("inf:y"),
    creator("inf:z"),
    creator("inf:w"),
  ];
  const existing = new Set(["x"]); // normalized (no inf: prefix)
  const picked = selectCreatorsToAdd(candidates, existing, 2);
  assert.deepEqual(picked.map((c) => c.unified_id), ["inf:y", "inf:z"]);
});

test("creatorEngagementRate reads the metric value", () => {
  assert.equal(creatorEngagementRate(creator("a", { er: 7.5 })), 7.5);
  assert.equal(creatorEngagementRate(creator("a")), null);
});
