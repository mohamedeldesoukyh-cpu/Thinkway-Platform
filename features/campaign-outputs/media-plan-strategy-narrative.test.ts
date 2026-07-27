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
  sumTierCounts,
} from "@/features/campaign-outputs/media-plan-strategy-narrative";
import { resolveAllowedMechanics, narrativeReferencesDisallowedMechanic } from "@/features/campaign-outputs/media-plan-mechanics-ssot";
import { buildMediaPlanStrategyBlocks } from "@/features/campaign-outputs/media-plan-strategy-blocks";
import {
  buildMediaPlanStrategySummary,
  buildThinkwayExecutiveSummary,
  refreshMediaPlanStrategySummaryForDisplay,
  type MediaPlanStrategySummary,
} from "@/features/campaign-outputs/media-plan-strategy-summary";
import { applyMediaPlanScheduleChange } from "@/features/campaign-outputs/media-plan-mutations";
import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import { weeklyObjectiveCardFlex, weeklyObjectiveWeightBarWidth } from "@/features/campaign-outputs/media-plan-week-objectives-layout";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";

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

  assert.match(narrative, /TikTok/i);
  assert.match(narrative, /Instagram/i);
  assert.match(narrative, /algorithm|trend|velocity|entertainment/i);
});

test("multi-platform allocation intelligence names every platform with role rationale", () => {
  const narrative = buildPlatformIntelligenceNarrative({
    platformAllocation: { TikTok: 4, Instagram: 2, Facebook: 1, YouTube: 1 },
    briefText: "Cross-platform summer campaign",
    audience: "Gen Z",
  });

  for (const platform of ["TikTok", "Instagram", "Facebook", "YouTube"]) {
    assert.match(narrative, new RegExp(platform, "i"));
  }
});

test("weekly objectives never mention UGC, duets, or stitches when brief and quotation lack them", () => {
  const slate = Array.from({ length: 3 }, (_, index) => ({
    creatorId: `cr-${index}`,
    displayName: `Creator ${index + 1}`,
    tier: "Macro",
    serviceTypes: ["1× IG Reel"],
  }));

  const objectives = buildWeeklyObjectives({
    weekWeights: [40, 30, 20, 10],
    briefText: "Brand awareness campaign for summer product launch among women 25–34.",
    objective: "Drive awareness and reach",
    slate,
  });

  const allGoals = objectives.flatMap((week) => week.goals).join(" ");
  const allowed = resolveAllowedMechanics({
    briefText: "Brand awareness campaign for summer product launch among women 25–34.",
    objective: "Drive awareness and reach",
    slate,
  });

  assert.doesNotMatch(allGoals, /\bugc\b/i);
  assert.doesNotMatch(allGoals, /\bduets?\b/i);
  assert.doesNotMatch(allGoals, /\bstitches?\b/i);
  assert.equal(narrativeReferencesDisallowedMechanic(allGoals, allowed), false);
});

test("weekly objectives include UGC only when quotation has explicit UGC deliverables", () => {
  const objectives = buildWeeklyObjectives({
    weekWeights: [40, 35, 15, 10],
    briefText: "Awareness campaign.",
    slate: [{ creatorId: "1", displayName: "UGC", tier: "Mid", serviceTypes: ["1× UGC"] }],
  });

  const amplifyGoals = objectives.find((week) => week.phase === "Amplify")?.goals.join(" ") ?? "";
  assert.match(amplifyGoals, /\bUGC\b/i);
});

test("rollout narrative avoids UGC language when brief lacks UGC mechanics", () => {
  const narrative = buildRolloutStrategyNarrative({
    weekWeights: [10, 15, 35, 40],
    durationWeeks: 4,
    briefText: "Build anticipation through the campaign and peak in the final weeks.",
    objective: "Maximise conversion in the closing phase",
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
  });

  assert.doesNotMatch(narrative, /\bugc\b/i);
});

test("creative recommendations exclude duets and stitches without brief or quotation signal", () => {
  const recommendations = buildCreativeRecommendations({
    briefText: "Premium beauty launch with GRWM and tutorial content.",
    objective: "Drive awareness",
    platformAllocation: { TikTok: 6, Instagram: 4 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel", "Story"] }],
  });

  assert.ok(!recommendations.some((entry) => /\bduets?\b/i.test(entry.format)));
  assert.ok(!recommendations.some((entry) => /\bstitches?\b/i.test(entry.format)));
  assert.ok(!recommendations.some((entry) => /\bugc\b/i.test(entry.format)));
});


test("music brief with song asset and challenge signal yields challenge-capable recommendations", () => {
  const recommendations = buildCreativeRecommendations({
    briefText: "Summer song launch with dance challenge — track link provided on Spotify. Upbeat pop, 120 BPM.",
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
  assert.equal(objectives[0]!.phase, "Reveal");
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

test("buildThinkwayExecutiveSummary lists every platform in quotation allocation", () => {
  const summary = buildThinkwayExecutiveSummary({
    objective: "Drive awareness",
    audience: "Gen Z",
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    platformAllocation: { TikTok: 8, Instagram: 4, Facebook: 2, YouTube: 2 },
    slate: [{ creatorId: "1", displayName: "Creator", tier: "Macro" }],
    briefText: "Multi-platform summer campaign.",
  });

  assert.ok(summary);
  assert.match(summary!, /TikTok/i);
  assert.match(summary!, /Instagram/i);
  assert.match(summary!, /Facebook/i);
  assert.match(summary!, /YouTube/i);
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
  assert.match(narrative.creatorMixIntelligence, /Evidence: 3 creators \(1 Mega, 1 Macro, 1 Micro\)/);
});

test("creator mix includes UGC chip counts only for explicit quotation UGC lines", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [70, 10, 10, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 17, Instagram: 3 },
    slate: [
      { creatorId: "1", displayName: "Mega A", tier: "Mega", serviceTypes: ["Reel"] },
      { creatorId: "2", displayName: "Macro B", tier: "Macro", serviceTypes: ["Reel"] },
      { creatorId: "3", displayName: "UGC Creator", tier: "Mid", serviceTypes: ["1× UGC"] },
      { creatorId: "4", displayName: "Instagram TBH", tier: "Macro", serviceTypes: ["1× IG Reel", "1× IG Set of stories"] },
    ],
    briefText: "Awareness and UGC challenge campaign.",
    objective: "Awareness and UGC",
  });

  assert.equal(narrative.evidence.ugcCreatorCount, 1);
  assert.equal(narrative.evidence.ugcDeliverableCount, 1);
  assert.match(narrative.evidence.tierSummary, /1 UGC/);
  assert.match(narrative.creatorMixIntelligence, /1 UGC creator/);

  const blocks = buildMediaPlanStrategyBlocks({
    hasContent: true,
    narrative,
  } as MediaPlanStrategySummary);
  const mix = blocks.find((block) => block.label === "Creator Mix Intelligence");
  assert.ok(mix?.tierChips?.some((chip) => chip.tier === "UGC" && chip.count === 1));
});

test("creator mix never infers UGC from brief or unclassified creators", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [70, 10, 10, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 83, Instagram: 17 },
    slate: [
      ...Array.from({ length: 3 }, (_, index) => ({
        creatorId: `mega-${index}`,
        displayName: `Mega ${index + 1}`,
        tier: "Mega",
        serviceTypes: ["1× TT Video"],
      })),
      ...Array.from({ length: 3 }, (_, index) => ({
        creatorId: `macro-${index}`,
        displayName: `Macro ${index + 1}`,
        tier: "Macro",
        serviceTypes: ["1× TT Video"],
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        creatorId: `mid-${index}`,
        displayName: `Mid ${index + 1}`,
        tier: "Mid",
        serviceTypes: ["1× TT Video"],
      })),
      ...Array.from({ length: 9 }, (_, index) => ({
        creatorId: `manual:ugc-${index}`,
        displayName: `Production ${index + 1}`,
        serviceTypes: ["1× IG Post"],
      })),
    ],
    briefText: "Awareness and UGC campaign.",
    objective: "Awareness and UGC",
  });

  assert.equal(narrative.evidence.ugcCreatorCount, 0);
  assert.doesNotMatch(narrative.evidence.tierSummary, /UGC/);
  assert.doesNotMatch(narrative.creatorMixIntelligence, /UGC creator/i);

  const blocks = buildMediaPlanStrategyBlocks({
    hasContent: true,
    narrative,
  } as MediaPlanStrategySummary);
  const mix = blocks.find((block) => block.label === "Creator Mix Intelligence");
  assert.ok(!mix?.tierChips?.some((chip) => chip.tier === "UGC"));
});

test("client-facing strategy blocks omit confidence labels", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [70, 10, 10, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 83, Instagram: 17 },
    slate: [{ creatorId: "1", displayName: "A", tier: "Macro", serviceTypes: ["Reel"] }],
    briefText: "Campaign",
    objective: "Awareness",
  });
  const blocks = buildMediaPlanStrategyBlocks(
    { hasContent: true, narrative } as MediaPlanStrategySummary,
    { clientFacing: true }
  );
  assert.ok(blocks.every((block) => !block.confidence));
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

test("creator mix tier chips sum to stated creator count when all creators are tier-classified", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [70, 10, 10, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 20, Instagram: 12 },
    slate: [
      ...Array.from({ length: 6 }, (_, index) => ({
        creatorId: `macro-${index}`,
        displayName: `Macro ${index + 1}`,
        tier: "Macro",
        serviceTypes: ["1× TT Video"],
      })),
      ...Array.from({ length: 9 }, (_, index) => ({
        creatorId: `mid-${index}`,
        displayName: `Mid ${index + 1}`,
        tier: "Mid",
        serviceTypes: ["1× TT Video"],
      })),
      ...Array.from({ length: 6 }, (_, index) => ({
        creatorId: `micro-${index}`,
        displayName: `Micro ${index + 1}`,
        tier: "Micro",
        serviceTypes: ["1× TT Video"],
      })),
      ...Array.from({ length: 11 }, (_, index) => ({
        creatorId: `ig-${index}`,
        displayName: `Instagram ${index + 1}`,
        tier: "Mid",
        serviceTypes: ["1× IG Post"],
      })),
    ],
    briefText: "Awareness campaign with mixed creator roster.",
    objective: "Awareness",
  });

  assert.equal(narrative.evidence.totalCreators, 32);
  assert.equal(sumTierCounts(narrative.evidence.tierCounts as Parameters<typeof sumTierCounts>[0]), 32);
  assert.equal(narrative.evidence.tierCounts.unknown, 0);
  assert.match(narrative.evidence.tierSummary, /6 Macro, 20 Mid, 6 Micro/);
  assert.doesNotMatch(narrative.evidence.tierSummary, /Unclassified/);
  assert.match(narrative.creatorMixIntelligence, /Evidence: 32 creators \(6 Macro, 20 Mid, 6 Micro\)/);

  const blocks = buildMediaPlanStrategyBlocks({
    hasContent: true,
    narrative,
  } as MediaPlanStrategySummary);
  const mix = blocks.find((block) => block.label === "Creator Mix Intelligence");
  const chipTotal = (mix?.tierChips ?? []).reduce((sum, chip) => sum + chip.count, 0);
  assert.equal(chipTotal, 32);
});

test("weekly objectives use calendar activityWeights for display when provided", () => {
  const objectives = buildWeeklyObjectives({
    weekWeights: [70, 10, 10, 10],
    activityWeights: [25, 25, 25, 25],
    briefText: "Launch-weighted summer campaign.",
    objective: "Drive awareness",
  });

  assert.deepEqual(
    objectives.map((week) => week.weight),
    [25, 25, 25, 25]
  );
  assert.equal(objectives[0]!.phase, "Reveal");
  assert.ok(objectives.every((week) => week.weight === 25));
});

test("weekly objective card flex uses equal width with internal weight bar", () => {
  assert.equal(weeklyObjectiveCardFlex(), "1 1 0");
  assert.equal(weeklyObjectiveWeightBarWidth(70), "70%");
});

test("W2 W3 W4 at equal 10% weights have distinct card labels and body text", () => {
  const objectives = buildWeeklyObjectives({
    weekWeights: [70, 10, 10, 10],
    briefText: "Launch-weighted summer campaign.",
    objective: "Drive awareness",
  });

  const trailing = objectives.slice(1);
  const phases = trailing.map((week) => week.phase);
  assert.deepEqual(phases, ["Trial", "Proof", "Convert"]);
  const bodies = trailing.map((week) => week.goals.join("|"));
  assert.equal(new Set(bodies).size, 3, "trailing week goal text must not duplicate");
});

test("buildMediaPlanStrategySummary uses calendar distribution for display weekWeights", () => {
  const object = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: Array.from({ length: 8 }, (_, index) => ({
      id: `cr_${index}`,
      name: `Creator ${index + 1}`,
      tier: index < 2 ? "Macro" : "Mid",
      serviceTypes: ["1× TT Video"],
    })),
  });
  object.meta.mediaPlanSchedule = {
    weekWeights: [70, 10, 10, 10],
    assignments: [{ creatorId: "cr_0", week: 4, dayIndex: 0, serviceType: "1× TT Video" }],
  };

  const summary = buildMediaPlanStrategySummary(object, { planMode: "strategy" });
  assert.deepEqual(summary.baselineWeekWeights, [70, 10, 10, 10]);
  assert.notDeepEqual(summary.weekWeights, [70, 10, 10, 10], "display weights should reflect scheduler distribution");
  assert.deepEqual(
    summary.narrative?.weeklyObjectives.map((week) => week.weight),
    summary.weekWeights
  );
  assert.equal(
    summary.narrative?.weeklyObjectives.reduce((sum, week) => sum + week.weight, 0),
    100
  );
});

test("rollout block includes creator tier split chips", () => {
  const slate = [
    ...Array.from({ length: 6 }, (_, index) => ({
      creatorId: `macro-${index}`,
      displayName: `Macro ${index + 1}`,
      tier: "Macro",
      serviceTypes: ["1× TT Video"],
    })),
    ...Array.from({ length: 16 }, (_, index) => ({
      creatorId: `mid-${index}`,
      displayName: `Mid ${index + 1}`,
      tier: "Mid",
      serviceTypes: ["1× TT Video"],
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      creatorId: `micro-${index}`,
      displayName: `Micro ${index + 1}`,
      tier: "Micro",
      serviceTypes: ["1× TT Video"],
    })),
  ];
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [70, 10, 10, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 32 },
    slate,
    briefText: "Awareness campaign.",
    objective: "Awareness",
  });
  const blocks = buildMediaPlanStrategyBlocks({
    hasContent: true,
    narrative,
    weekWeights: [70, 10, 10, 10],
  });
  const rollout = blocks.find((block) => block.label === "Campaign Rollout Strategy");
  assert.ok(rollout?.weekWeights?.length);
  assert.ok(rollout?.tierChips?.some((chip) => chip.tier === "Macro" && chip.count === 6));
  assert.ok(rollout?.tierChips?.some((chip) => chip.tier === "Mid" && chip.count === 16));
  assert.ok(rollout?.tierChips?.some((chip) => chip.tier === "Micro" && chip.count === 10));
});

test("rollout and weekly objectives stay aligned after refresh", () => {
  const object = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: Array.from({ length: 8 }, (_, index) => ({
      id: `cr_${index}`,
      name: `Creator ${index + 1}`,
      tier: index === 0 ? "Mega" : "Mid",
      serviceTypes: ["1× TT Video"],
    })),
  });
  object.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const content = generateMediaPlan(object);
  assert.ok(content.data);
  const data = content.data as MediaPlanData;
  const refreshed =
    refreshMediaPlanStrategySummaryForDisplay(data.strategySummary, data) ?? data.strategySummary;

  const displayWeights = refreshed?.weekWeights ?? [];
  const objectiveWeights = refreshed!.narrative!.weeklyObjectives.map((week) => week.weight);
  assert.deepEqual(objectiveWeights, displayWeights, "weekly objectives must match calendar distribution");
  assert.equal(objectiveWeights.reduce((sum, weight) => sum + weight, 0), 100);
  assert.deepEqual(refreshed?.baselineWeekWeights, [70, 10, 10, 10]);
});

test("refreshMediaPlanStrategySummaryForDisplay fills missing calendar tiers from reference slate", () => {
  const narrative = buildMediaPlanStrategyNarrative({
    weekWeights: [70, 10, 10, 10],
    durationWeeks: 4,
    platformAllocation: { TikTok: 20, Instagram: 12 },
    slate: [
      { creatorId: "macro-1", displayName: "Macro 1", tier: "Macro", serviceTypes: ["1× TT Video"] },
      { creatorId: "mid-1", displayName: "Mid 1", tier: "Mid", serviceTypes: ["1× IG Post"] },
    ],
    briefText: "Awareness campaign.",
    objective: "Awareness",
  });

  const refreshed = refreshMediaPlanStrategySummaryForDisplay(
    { hasContent: true, narrative, weekWeights: [70, 10, 10, 10] },
    {
      durationWeeks: 4,
      platformAllocation: { TikTok: 20, Instagram: 12 },
      referenceSlate: [
        { creatorId: "macro-1", displayName: "Macro 1", tier: "Macro", serviceTypes: ["1× TT Video"] },
        { creatorId: "mid-1", displayName: "Mid 1", tier: "Mid", serviceTypes: ["1× IG Post"] },
      ],
      weeks: [
        {
          days: [
            {
              creatorId: "macro-1",
              creator: "Macro 1",
              tier: "Macro",
              serviceType: "1× TT Video",
            },
          ],
        },
        {
          days: [
            {
              creatorId: "macro-1",
              creator: "Macro 1",
              additionalDeliverables: [
                {
                  creatorId: "mid-1",
                  creator: "Mid 1",
                  serviceType: "1× IG Post",
                },
              ],
            },
          ],
        },
      ],
    }
  );

  assert.equal(refreshed?.narrative?.evidence.tierCounts.unknown, 0);
  assert.match(refreshed?.narrative?.evidence.tierSummary ?? "", /1 Macro, 1 Mid/);
});

