import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  buildCreativeRecommendations,
  buildMediaPlanStrategyNarrative,
  buildPlatformIntelligenceNarrative,
  buildRolloutStrategyNarrative,
  buildWeeklyObjectives,
  deliverableCountForCreator,
  isBriefCopyText,
  sanitizeBriefSignalText,
} from "@/features/campaign-outputs/media-plan-strategy-narrative";
import { buildMediaPlanStrategySummary, buildThinkwayExecutiveSummary } from "@/features/campaign-outputs/media-plan-strategy-summary";
import { applyMediaPlanScheduleChange } from "@/features/campaign-outputs/media-plan-schedule";

test("front-loaded weights produce launch momentum rationale with exact percentages", () => {
  const weights = [40, 35, 15, 10];
  const narrative = buildRolloutStrategyNarrative({
    weekWeights: weights,
    durationWeeks: 4,
    briefText: "Summer song launch — front-load awareness in week 1 and 2.",
    objective: "Drive 10M reach for the summer product drop",
  });

  assert.match(narrative, /40%/);
  assert.match(narrative, /W1 40%/i);
  assert.match(narrative, /launch momentum|awareness|social conversation/i);
  assert.doesNotMatch(narrative, /Launch phase concentrates creator activity in early weeks to maximise awareness at campaign start/);
});

test("building momentum weights explain staggered rollout and final-week peak", () => {
  const weights = [10, 15, 35, 40];
  const narrative = buildRolloutStrategyNarrative({
    weekWeights: weights,
    durationWeeks: 4,
    briefText: "Build anticipation through the campaign and peak in the final weeks.",
    objective: "Maximise conversion in the closing phase",
  });

  assert.match(narrative, /10%/);
  assert.match(narrative, /40%/);
  assert.match(narrative, /anticipation|building|final|closing|peak/i);
  assert.doesNotMatch(narrative, /Publishing builds progressively across the campaign, accelerating toward peak engagement/);
});

test("different weight profiles produce distinct rollout narratives", () => {
  const frontLoaded = buildRolloutStrategyNarrative({
    weekWeights: [40, 35, 15, 10],
    durationWeeks: 4,
    briefText: "Summer launch campaign for a new track.",
  });
  const building = buildRolloutStrategyNarrative({
    weekWeights: [10, 15, 35, 40],
    durationWeeks: 4,
    briefText: "Summer launch campaign for a new track.",
  });

  assert.notEqual(frontLoaded, building);
});

test("TikTok-dominant allocation explains algorithm and viral behaviour", () => {
  const narrative = buildPlatformIntelligenceNarrative({
    platformAllocation: { TikTok: 8, Instagram: 2 },
    briefText: "Youth-first summer music campaign",
    audience: "Gen Z 16–24",
  });

  assert.match(narrative, /80%.*TikTok|TikTok.*80%/i);
  assert.match(narrative, /algorithm|viral|trend|audio|recommendation/i);
});

test("Instagram-dominant allocation explains Reels and credibility", () => {
  const narrative = buildPlatformIntelligenceNarrative({
    platformAllocation: { Instagram: 9, TikTok: 1 },
    briefText: "Beauty brand launch with premium positioning",
    audience: "Women 25–34",
  });

  assert.match(narrative, /90%.*Instagram|Instagram.*90%/i);
  assert.match(narrative, /Reels|Stories|credibility|visual/i);
});

test("music brief with song asset and 3 deliverables yields challenge-capable recommendations", () => {
  const recommendations = buildCreativeRecommendations({
    briefText: "Summer song launch — track link provided on Spotify. Upbeat pop, 120 BPM.",
    objective: "Drive awareness and UGC",
    platformAllocation: { TikTok: 10 },
    slate: [
      { creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel", "TikTok", "Story"] },
    ],
  });

  assert.ok(recommendations.length >= 3);
  assert.ok(recommendations.every((entry) => entry.format && entry.reason));
  assert.ok(recommendations.some((entry) => /challenge|funnel|awareness/i.test(entry.format)));
});

test("music brief without song asset avoids high-confidence dance and lip-sync recommendations", () => {
  const recommendations = buildCreativeRecommendations({
    briefText: "We have an upcoming summer campaign for a new song — details to follow.",
    objective: "Drive awareness",
    platformAllocation: { TikTok: 10 },
    slate: [
      { creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel", "TikTok"] },
    ],
  });

  assert.ok(!recommendations.some((entry) => /\bdance challenge\b/i.test(entry.format)));
  assert.ok(!recommendations.some((entry) => /\blip-sync\b/i.test(entry.format)));
  assert.ok(recommendations.some((entry) => /lifestyle|song usage|hook/i.test(entry.format)));
});

test("weekly objectives derive phase and goals from weights", () => {
  const objectives = buildWeeklyObjectives({
    weekWeights: [40, 35, 15, 10],
    briefText: "Launch the summer song with a hero moment in week 1.",
    objective: "Drive awareness",
  });

  assert.equal(objectives.length, 4);
  assert.equal(objectives[0]!.phase, "Launch");
  assert.equal(objectives[0]!.weight, 40);
  assert.ok(objectives[0]!.goals.some((goal) => /awareness|introduce|curiosity/i.test(goal)));
});

test("buildMediaPlanStrategySummary embeds full narrative on fixture", () => {
  const object = buildCampaignObjectFixture({
    strategyContent:
      "Front-load week 1 for the summer song launch. TikTok-first with dance challenges.",
    facts: {
      rawBriefExcerpt:
        "Summer launch for Acme — front-load awareness in the first two weeks, then sustain engagement.",
      objective: "Drive 10M reach for the summer product drop",
      durationWeeks: 4,
      platforms: ["TikTok", "Instagram"],
    },
  });

  const summary = buildMediaPlanStrategySummary(object, {
    platformAllocation: { TikTok: 8, Instagram: 2 },
  });

  assert.ok(summary.narrative);
  assert.ok(summary.narrative!.rolloutStrategy);
  assert.ok(summary.narrative!.platformIntelligence);
  assert.ok(summary.narrative!.creatorMixIntelligence);
  assert.equal(summary.narrative!.weeklyObjectives.length, 4);
  assert.ok(summary.narrative!.creativeRecommendations.length >= 3);
  assert.ok(summary.narrative!.creatorTypeRecommendations.length >= 1);
});

test("schedule change regenerates narrative via media plan summary rebuild", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt:
        "Four-week campaign — even distribution with flexibility to shift creators on the calendar.",
      durationWeeks: 4,
    },
  });

  const before = buildMediaPlanStrategySummary(object);
  const moved = applyMediaPlanScheduleChange(object, {
    moveCreators: [{ creatorIds: ["cr_star"], toWeek: 1, toDayIndex: 0 }],
  });
  const after = buildMediaPlanStrategySummary(moved.campaignObject);

  assert.ok(before.narrative?.rolloutStrategy);
  assert.ok(after.narrative?.rolloutStrategy);
});

test("single-deliverable slate excludes competition and multi-part creative formats", () => {
  const recommendations = buildCreativeRecommendations({
    briefText: "Summer song on Spotify — upbeat pop track link provided.",
    platformAllocation: { TikTok: 4 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Micro", serviceTypes: ["Reel"] }],
  });

  assert.equal(deliverableCountForCreator({ creatorId: "1", displayName: "A", serviceTypes: ["Reel"] }), 1);
  assert.ok(!recommendations.some((entry) => /competition|multi-part|funnel|winner/i.test(entry.format)));
  assert.ok(recommendations.some((entry) => /lifestyle integration/i.test(entry.format)));
});

test("isBriefCopyText detects verbatim client email boilerplate", () => {
  assert.equal(
    isBriefCopyText("Please find below client brief for the summer campaign."),
    true
  );
  assert.equal(
    isBriefCopyText("We have an upcoming summer campaign for a new product launch."),
    true
  );
  assert.equal(sanitizeBriefSignalText("Please find below client brief for summer."), "");
});

test("buildThinkwayExecutiveSummary never copies raw brief email language", () => {
  const summary = buildThinkwayExecutiveSummary({
    objective: "Drive 10M reach for the summer product drop",
    audience: "Women 18–34",
    durationWeeks: 4,
    weekWeights: [40, 35, 15, 10],
    platformAllocation: { TikTok: 8, Instagram: 2 },
    slate: [
      { creatorId: "1", displayName: "Star", tier: "Celebrity" },
      { creatorId: "2", displayName: "Macro", tier: "Macro" },
    ],
    briefText: "Please find below client brief. We have an upcoming summer campaign for a new song.",
  });

  assert.ok(summary);
  assert.match(summary!, /Thinkway recommends/i);
  assert.doesNotMatch(summary!, /please find below/i);
  assert.doesNotMatch(summary!, /we have an upcoming/i);
});

test("creator mix narrative only references tiers present in slate", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [25, 25, 25, 25],
    durationWeeks: 4,
    platformAllocation: { Instagram: 4 },
    slate: [
      { creatorId: "1", displayName: "Star", tier: "Celebrity" },
      { creatorId: "2", displayName: "Macro", tier: "Macro" },
      { creatorId: "3", displayName: "Micro", tier: "Micro" },
    ],
    briefText: "Multi-tier creator campaign for brand awareness.",
  });

  assert.match(narrative.creatorMixIntelligence, /1 Mega, 1 Macro, 1 Micro/);
  assert.doesNotMatch(narrative.creatorMixIntelligence, /\bNano\b/i);
  assert.match(narrative.creatorMixIntelligence, /Evidence: 3 creators/);
});

test("strategy narrative includes confidence labels for each section", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [40, 30, 20, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 6, Instagram: 4 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
    briefText: "Summer launch campaign",
    objective: "Drive awareness",
  });

  assert.equal(narrative.rolloutConfidence.level, "high");
  assert.equal(narrative.platformConfidence.level, "high");
  assert.equal(narrative.creatorMixConfidence.level, "high");
  assert.equal(narrative.weeklyObjectivesConfidence.level, "high");
  assert.ok(["medium", "low"].includes(narrative.creativeConfidence.level));
  assert.ok(narrative.creativeLimitations?.includes("1 post per creator"));
});

test("buildMediaPlanStrategySummary executive summary uses Thinkway voice not raw brief", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      rawBriefExcerpt:
        "Please find below client brief. We have an upcoming summer campaign for a new song.",
      objective: "Drive 10M reach for the summer product drop",
      durationWeeks: 4,
      platforms: ["TikTok", "Instagram"],
    },
  });

  const summary = buildMediaPlanStrategySummary(object, {
    platformAllocation: { TikTok: 8, Instagram: 2 },
  });

  assert.ok(summary.executiveSummary);
  assert.match(summary.executiveSummary!, /Thinkway recommends/i);
  assert.doesNotMatch(summary.executiveSummary!, /please find below/i);
});
