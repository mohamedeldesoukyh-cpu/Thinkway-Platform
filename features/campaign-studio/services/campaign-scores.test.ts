import assert from "node:assert/strict";
import test from "node:test";

import type { SearchCreatorCardItem } from "./creator-platform-utils";
import { computeCampaignScores } from "./campaign-scores";

function card(
  id: string,
  platform: string,
  followers: number,
  engagementRate?: number,
  categories: string[] = []
): SearchCreatorCardItem {
  return { id, handle: id, displayName: id, platform, followers, engagementRate, categories };
}

const TIKTOK_FACTS = {
  platforms: ["TikTok"],
  budget: { amount: 1_000_000, currency: "EGP" },
} as never;

const STRONG_SLATE = [
  card("inf:a", "tiktok", 6_000_000, 7, ["Dance"]),
  card("inf:b", "tiktok", 1_500_000, 6, ["Comedy"]),
  card("inf:c", "tiktok", 200_000, 8, ["Food & Cooking"]),
  card("inf:d", "tiktok", 30_000, 11, ["Fashion"]),
  card("inf:e", "tiktok", 8_000, 13, ["Lifestyle"]),
];

const MIX = [
  { tier: "Celebrity", percent: 17 },
  { tier: "Mega", percent: 17 },
  { tier: "Macro", percent: 17 },
  { tier: "Mid", percent: 17 },
  { tier: "Micro", percent: 16 },
  { tier: "Nano", percent: 16 },
];

test("a strong on-platform slate scores high across the board", () => {
  const scores = computeCampaignScores({
    cards: STRONG_SLATE,
    facts: TIKTOK_FACTS,
    fitScores: { a: 88, b: 82, c: 79, d: 85, e: 90 },
    tierMix: MIX,
  });

  assert.ok(scores.overall >= 70, `overall ${scores.overall}`);
  assert.ok(scores.brandFit >= 80, `brandFit ${scores.brandFit}`);
  assert.ok(scores.audienceMatch >= 85, `audienceMatch ${scores.audienceMatch}`);
  assert.ok(scores.engagementForecast >= 60, `engagement ${scores.engagementForecast}`);
  assert.ok(scores.contentCoverage >= 90, `coverage ${scores.contentCoverage}`);
  assert.equal(scores.basis.length, 7);
});

test("off-platform creators and un-enriched picks pull audience match and risk down", () => {
  const compliant = computeCampaignScores({
    cards: STRONG_SLATE,
    facts: TIKTOK_FACTS,
    tierMix: MIX,
  });
  const drifted = computeCampaignScores({
    cards: [
      ...STRONG_SLATE.slice(0, 3),
      card("inf:x", "instagram", 900_000, 3),
      card("inf:y", "instagram", 500_000, 2),
    ],
    facts: TIKTOK_FACTS,
    tierMix: MIX,
    unenrichedCreatorIds: ["inf:x", "inf:y"],
  });

  assert.ok(drifted.audienceMatch < compliant.audienceMatch);
  assert.ok(drifted.risk < compliant.risk);
});

test("fit scores match creators across inf:-prefixed and raw ids", () => {
  const scores = computeCampaignScores({
    cards: [card("inf:a", "tiktok", 100_000, 6)],
    fitScores: { a: 95 },
  });
  assert.equal(scores.brandFit, 95);
});

test("empty slate degrades gracefully with explainable basis", () => {
  const scores = computeCampaignScores({ cards: [] });
  assert.ok(scores.overall > 0);
  assert.equal(scores.brandFit, 40);
  assert.ok(scores.basis.every((line) => typeof line === "string" && line.length > 0));
});

test("single-creator concentration is flagged in risk", () => {
  const concentrated = computeCampaignScores({
    cards: [card("inf:a", "tiktok", 9_000_000, 6), card("inf:b", "tiktok", 50_000, 8)],
    facts: TIKTOK_FACTS,
  });
  const balanced = computeCampaignScores({
    cards: [card("inf:a", "tiktok", 800_000, 6), card("inf:b", "tiktok", 800_000, 8)],
    facts: TIKTOK_FACTS,
  });
  assert.ok(concentrated.risk < balanced.risk);
});
