import assert from "node:assert/strict";
import test from "node:test";

import {
  getInfluencerTier,
  getTierFollowerRange,
  INFLUENCER_TIER_THRESHOLDS,
  matchesInfluencerTier,
  normalizeInfluencerTier,
  TIER_FILTER_RANGES,
} from "./influencer-tier";

test("getInfluencerTier boundary cases", () => {
  assert.equal(getInfluencerTier(0), "Nano");
  assert.equal(getInfluencerTier(999), "Nano");
  assert.equal(getInfluencerTier(9_999), "Nano");
  assert.equal(getInfluencerTier(10_000), "Micro");
  assert.equal(getInfluencerTier(99_999), "Micro");
  assert.equal(getInfluencerTier(100_000), "Mid");
  assert.equal(getInfluencerTier(499_999), "Mid");
  assert.equal(getInfluencerTier(500_000), "Macro");
  assert.equal(getInfluencerTier(999_999), "Macro");
  assert.equal(getInfluencerTier(1_000_000), "Mega");
  assert.equal(getInfluencerTier(4_999_999), "Mega");
  assert.equal(getInfluencerTier(5_000_000), "Celebrity");
  assert.equal(getInfluencerTier(12_000_000), "Celebrity");
});

test("threshold constants align with classification", () => {
  assert.equal(getInfluencerTier(INFLUENCER_TIER_THRESHOLDS.nano - 1), "Nano");
  assert.equal(getInfluencerTier(INFLUENCER_TIER_THRESHOLDS.mega), "Celebrity");
});

test("normalizeInfluencerTier maps legacy labels", () => {
  assert.equal(normalizeInfluencerTier("Mid-Tier"), "Mid");
  assert.equal(normalizeInfluencerTier("mega"), "Mega");
  assert.equal(normalizeInfluencerTier("Celebrity"), "Celebrity");
  assert.equal(normalizeInfluencerTier(""), null);
});

test("matchesInfluencerTier accepts legacy mix names", () => {
  assert.equal(matchesInfluencerTier("Mid", "Mid"), true);
  assert.equal(matchesInfluencerTier("mid-tier", "Mid"), true);
  assert.equal(matchesInfluencerTier("Macro", "Mega"), false);
});

test("TIER_FILTER_RANGES align with tier bands", () => {
  for (const range of TIER_FILTER_RANGES) {
    assert.equal(getInfluencerTier(range.min), range.tier);
    if (range.max != null) {
      assert.equal(getInfluencerTier(range.max), range.tier);
    }
  }
  const celebrity = TIER_FILTER_RANGES.find((r) => r.tier === "Celebrity");
  assert.ok(celebrity);
  assert.equal(getTierFollowerRange("Celebrity").minFollowers, celebrity!.min);
});

test("getTierFollowerRange returns non-overlapping bands", () => {
  assert.deepEqual(getTierFollowerRange("Macro"), {
    minFollowers: 500_000,
    maxFollowers: 999_999,
  });
  assert.deepEqual(getTierFollowerRange("Micro"), {
    minFollowers: 10_000,
    maxFollowers: 99_999,
  });
  assert.deepEqual(getTierFollowerRange("Celebrity"), { minFollowers: 5_000_000 });
  assert.deepEqual(getTierFollowerRange("Nano"), { minFollowers: 1_000, maxFollowers: 9_999 });
});
