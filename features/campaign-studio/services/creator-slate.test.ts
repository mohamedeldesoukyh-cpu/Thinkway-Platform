import assert from "node:assert/strict";
import test from "node:test";

import type { SearchCreatorCardItem } from "./creator-platform-utils";
import {
  allocateTierCounts,
  buildCreatorContentIdea,
  composeCreatorSlate,
  isTrendCampaign,
} from "./creator-slate";

function creator(
  id: string,
  platform: string,
  followers: number,
  categories: string[] = []
): SearchCreatorCardItem {
  return { id, handle: id, displayName: id, platform, followers, categories };
}

const E_AND_FACTS = {
  objective:
    "Activate our Summer 2026 campaign song on TikTok and IG by creating a cultural moment",
  rawBriefExcerpt: "Turn the campaign song into one of the biggest TikTok sounds of Summer 2026",
};

test("explicit brief platform is a hard constraint — TikTok brief never recommends IG creators", () => {
  const pool = [
    creator("ig-1", "instagram", 900_000),
    creator("tt-1", "tiktok", 800_000),
    creator("ig-2", "instagram", 700_000),
    creator("tt-2", "tiktok", 60_000),
    creator("tt-3", "tiktok", 20_000),
    creator("tt-4", "tiktok", 5_000),
  ];

  const { creators, meta } = composeCreatorSlate(pool, { platforms: ["TikTok"] });
  assert.ok(creators.length >= 3);
  assert.ok(creators.every((c) => c.platform === "tiktok"));
  assert.equal(meta.platformFiltered, true);
  assert.equal(meta.platformFallback, false);
});

test("platform filter falls back instead of returning an empty slate", () => {
  const pool = [creator("ig-1", "instagram", 100_000), creator("ig-2", "instagram", 50_000)];
  const { creators, meta } = composeCreatorSlate(pool, { platforms: ["TikTok"] });
  assert.equal(creators.length, 2);
  assert.equal(meta.platformFallback, true);
});

test("strictPlatform never falls back to off-platform creators", () => {
  const pool = [creator("ig-1", "instagram", 100_000), creator("ig-2", "instagram", 50_000)];
  const { creators, meta } = composeCreatorSlate(pool, {
    platforms: ["TikTok"],
    strictPlatform: true,
  });
  assert.equal(creators.length, 0);
  assert.equal(meta.platformFiltered, true);
  assert.equal(meta.platformFallback, false);
});

test("slate tier distribution tracks the strategy mix", () => {
  const pool = [
    // 6 macro (500k–1M per TIER_FILTER_RANGES; 1M+ would be Mega), 8 mid, 8 micro, 8 nano
    ...Array.from({ length: 6 }, (_, i) => creator(`macro-${i}`, "tiktok", 800_000)),
    ...Array.from({ length: 8 }, (_, i) => creator(`mid-${i}`, "tiktok", 200_000)),
    ...Array.from({ length: 8 }, (_, i) => creator(`micro-${i}`, "tiktok", 20_000)),
    ...Array.from({ length: 8 }, (_, i) => creator(`nano-${i}`, "tiktok", 5_000)),
  ];
  const mix = [
    { tier: "Macro", percent: 40 },
    { tier: "Micro", percent: 35 },
    { tier: "Nano", percent: 25 },
  ];

  const { creators, meta } = composeCreatorSlate(pool, { tierMix: mix, targetCount: 20 });
  assert.equal(creators.length, 20);

  const counts = Object.fromEntries(meta.achievedMix.map((m) => [m.tier, m.count]));
  // 40/35/25 of 20 → 8 macro, 7 micro, 5 nano (macro capped at 6 available + backfill)
  assert.ok((counts["macro"] ?? 0) >= 6, `macro ${counts["macro"]}`);
  assert.ok((counts["micro"] ?? 0) >= 6, `micro ${counts["micro"]}`);
  assert.ok((counts["nano"] ?? 0) >= 4, `nano ${counts["nano"]}`);
});

test("largest-remainder allocation sums to the target count", () => {
  const counts = allocateTierCounts(
    [
      { tier: "Macro", percent: 40 },
      { tier: "Micro", percent: 35 },
      { tier: "Nano", percent: 25 },
    ],
    10
  );
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  assert.equal(total, 10);
  assert.equal(counts.get("macro"), 4);
});

test("trend campaigns get sound-first content ideas matched to creator category", () => {
  assert.equal(isTrendCampaign(E_AND_FACTS), true);

  const dance = buildCreatorContentIdea({ categories: ["Dance", "Entertainment"] }, E_AND_FACTS);
  assert.match(dance, /dance challenge/i);

  const food = buildCreatorContentIdea({ categories: ["Food & Cooking"] }, E_AND_FACTS);
  assert.match(food, /cooking/i);

  const unknown = buildCreatorContentIdea({ categories: [] }, E_AND_FACTS, 0);
  assert.match(unknown, /sound/i);

  // Non-trend campaigns never mention "the official sound".
  const generic = buildCreatorContentIdea(
    { categories: ["Beauty"] },
    { objective: "Drive consideration for a skincare launch", rawBriefExcerpt: "" }
  );
  assert.doesNotMatch(generic, /official sound/i);
});
