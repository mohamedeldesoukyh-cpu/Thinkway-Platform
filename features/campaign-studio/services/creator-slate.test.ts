import assert from "node:assert/strict";
import test from "node:test";

import type { SearchCreatorCardItem } from "./creator-platform-utils";
import {
  allocateTierCounts,
  buildCreatorContentIdea,
  composeCreatorSlate,
  isTrendCampaign,
  sanitizePreferredCategories,
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

test("preferred categories soft-bias the slate before off-category backfill", () => {
  const pool = [
    creator("food-1", "instagram", 400_000, ["Food"]),
    creator("beauty-1", "instagram", 220_000, ["Beauty"]),
    creator("travel-1", "instagram", 380_000, ["Travel"]),
    creator("beauty-2", "instagram", 180_000, ["Beauty", "Fashion"]),
    creator("beauty-3", "instagram", 90_000, ["Beauty"]),
  ];
  const { creators } = composeCreatorSlate(pool, {
    preferredCategories: ["Beauty"],
    targetCount: 3,
  });
  assert.equal(creators.length, 3);
  assert.ok(creators.every((c) => (c.categories ?? []).includes("Beauty")));
});

test("sanitizePreferredCategories drops Lifestyle when a vertical is present", () => {
  assert.deepEqual(sanitizePreferredCategories(["Beauty", "Lifestyle", "Skincare"]), [
    "beauty",
    "skincare",
  ]);
  assert.deepEqual(sanitizePreferredCategories(["Lifestyle"]), ["lifestyle"]);
});

test("beauty briefs do not pad with Lifestyle when enough Beauty creators exist", () => {
  const pool = [
    ...Array.from({ length: 6 }, (_, i) =>
      creator(`beauty-${i}`, "instagram", 200_000 - i * 10_000, ["Beauty"])
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      creator(`life-${i}`, "instagram", 500_000 - i * 10_000, ["Lifestyle"])
    ),
  ];
  const { creators, meta } = composeCreatorSlate(pool, {
    preferredCategories: ["Beauty", "Lifestyle"],
    targetCount: 10,
  });
  assert.ok(creators.length >= 5);
  assert.ok(creators.every((c) => (c.categories ?? []).includes("Beauty")));
  assert.equal(meta.categoryFallback, false);
  assert.ok(!creators.some((c) => c.id.startsWith("life-")));
});

test("thin beauty inventory pads with adjacent categories and explains it", () => {
  const pool = [
    creator("beauty-1", "instagram", 220_000, ["Beauty"]),
    creator("beauty-2", "instagram", 180_000, ["Beauty"]),
    creator("life-1", "instagram", 400_000, ["Lifestyle"]),
    creator("life-2", "instagram", 350_000, ["Lifestyle"]),
    creator("life-3", "instagram", 300_000, ["Lifestyle"]),
    creator("food-1", "instagram", 280_000, ["Food"]),
  ];
  const { creators, meta } = composeCreatorSlate(pool, {
    preferredCategories: ["Beauty"],
    targetCount: 10,
  });
  assert.equal(meta.categoryFallback, true);
  assert.ok((meta.offCategoryPadCount ?? 0) >= 1);
  assert.match(meta.categoryFallbackReason ?? "", /padded|adjacent/i);
  assert.ok(creators.some((c) => (c.categories ?? []).includes("Beauty")));
});

test("tech briefs with ≥3 on-category creators do not pad with food/lifestyle", () => {
  const pool = [
    { ...creator("tech-1", "instagram", 90_000, ["Tech"]), campaignRelevanceScore: 85 },
    { ...creator("tech-2", "instagram", 80_000, ["Tech"]), campaignRelevanceScore: 80 },
    { ...creator("tech-3", "instagram", 70_000, ["Tech"]), campaignRelevanceScore: 75 },
    { ...creator("tech-4", "instagram", 60_000, ["Tech"]), campaignRelevanceScore: 75 },
    { ...creator("food-1", "instagram", 400_000, ["Food"]), campaignRelevanceScore: 65 },
  ];
  const { creators, meta } = composeCreatorSlate(pool, {
    preferredCategories: ["Tech"],
    targetCount: 5,
  });
  assert.ok(creators.every((c) => (c.categories ?? []).includes("Tech")));
  assert.equal(meta.categoryFallback, false);
  assert.ok(!creators.some((c) => c.id === "food-1"));
});

test("low campaign-fit celebrities are demoted when stronger fits exist", () => {
  const pool = [
    { ...creator("celeb", "instagram", 10_000_000, ["Lifestyle"]), campaignRelevanceScore: 30 },
    { ...creator("fit-a", "instagram", 700_000, ["Lifestyle"]), campaignRelevanceScore: 75 },
    { ...creator("fit-b", "instagram", 600_000, ["Lifestyle"]), campaignRelevanceScore: 70 },
    { ...creator("fit-c", "instagram", 500_000, ["Lifestyle"]), campaignRelevanceScore: 65 },
  ];
  const { creators } = composeCreatorSlate(pool, { targetCount: 3 });
  assert.equal(creators.length, 3);
  assert.ok(!creators.some((c) => c.id === "celeb"));
});

test("when all scored creators are below fit floor, slate stays empty rather than padding weak", () => {
  const pool = [
    { ...creator("weak-a", "instagram", 200_000, ["Tech"]), campaignRelevanceScore: 40 },
    { ...creator("weak-b", "instagram", 180_000, ["Tech"]), campaignRelevanceScore: 35 },
    { ...creator("weak-c", "instagram", 160_000, ["Tech"]), campaignRelevanceScore: 30 },
  ];
  const { creators } = composeCreatorSlate(pool, {
    preferredCategories: ["Tech"],
    targetCount: 5,
  });
  assert.equal(creators.length, 0);
});

test("near-zero engagement creators are demoted when stronger options exist", () => {
  const pool = [
    {
      ...creator("dead", "instagram", 200_000, ["Beauty"]),
      campaignRelevanceScore: 70,
      engagementRate: 0.09,
    },
    {
      ...creator("alive-a", "instagram", 180_000, ["Beauty"]),
      campaignRelevanceScore: 72,
      engagementRate: 3.1,
    },
    {
      ...creator("alive-b", "instagram", 160_000, ["Beauty"]),
      campaignRelevanceScore: 68,
      engagementRate: 2.4,
    },
    {
      ...creator("alive-c", "instagram", 140_000, ["Beauty"]),
      campaignRelevanceScore: 65,
      engagementRate: 1.8,
    },
  ];
  const { creators } = composeCreatorSlate(pool, {
    preferredCategories: ["Beauty"],
    targetCount: 3,
  });
  assert.equal(creators.length, 3);
  assert.ok(!creators.some((c) => c.id === "dead"));
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
