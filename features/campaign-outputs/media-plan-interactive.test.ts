import { strict as assert } from "node:assert";
import { test } from "node:test";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { applyMediaPlanScheduleChange } from "@/features/campaign-outputs/media-plan-schedule";
import {
  buildCreativeDirectionThemes,
  buildMediaPlanStrategySummary,
  buildPublishingRhythmRationale,
  detectWeightProfile,
} from "@/features/campaign-outputs/media-plan-strategy-summary";
import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";
import { buildMediaPlanHtml } from "@/features/campaign-outputs/export/media-plan-html";
import {
  generateCampaignOutput,
  getOutputContentForDisplay,
} from "@/features/campaign-outputs/output-registry";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function mediaPlanData(content: ReturnType<typeof generateMediaPlan>): MediaPlanData {
  assert.ok(content.data);
  return content.data as MediaPlanData;
}

function findCreatorSlot(data: MediaPlanData, creatorId: string) {
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.creatorId === creatorId) {
        return {
          week: week.week,
          day: day.day,
          dayIndex: DAYS.indexOf(day.day),
          types: day.serviceTypes?.length
            ? day.serviceTypes
            : day.serviceType
              ? [day.serviceType]
              : [],
        };
      }
      for (const extra of day.additionalDeliverables ?? []) {
        if (extra.creatorId === creatorId && !extra.isMirror && !extra.isCompanion) {
          return {
            week: week.week,
            day: day.day,
            dayIndex: DAYS.indexOf(day.day),
            types: extra.serviceTypes?.length
              ? extra.serviceTypes
              : extra.serviceType
                ? [extra.serviceType]
                : [],
          };
        }
      }
    }
  }
  return null;
}

test("buildMediaPlanStrategySummary derives objective and week weights from brief", () => {
  const object = buildCampaignObjectFixture({
    strategyContent:
      "Launch-heavy burst in week 1 with sustained Macro creators through weeks 2–4. Peak moment in week 3.",
    facts: {
      rawBriefExcerpt:
        "Summer launch for Acme — front-load awareness in the first two weeks, then sustain engagement.",
      objective: "Drive 10M reach for the summer product drop",
      durationWeeks: 4,
      platforms: ["TikTok", "Instagram"],
    },
  });

  const summary = buildMediaPlanStrategySummary(object, {
    platformAllocation: { TikTok: 4, Instagram: 4 },
  });
  assert.equal(summary.hasContent, true);
  assert.ok(summary.objective?.includes("10M reach"));
  assert.ok(summary.launchApproach);
  assert.ok(summary.weekWeightRationale?.match(/W1|Week 1/i));
  assert.ok(summary.weekWeightRationale?.match(/launch|momentum|awareness/i));
  assert.equal(summary.weekWeights?.length, 4);
  assert.ok(summary.narrative?.creativeRecommendations.length);
});

test("buildMediaPlanStrategySummary returns placeholder-friendly empty state", () => {
  const object = buildCampaignObjectFixture({
    strategyContent: "",
    creators: [],
    facts: { objective: "", durationWeeks: 4 },
  });
  object.sections.summary = { content: "", status: "complete" };
  object.sections.creators = { content: "", status: "complete" };

  const summary = buildMediaPlanStrategySummary(object);
  assert.equal(summary.hasContent, false);
});

test("applyMediaPlanScheduleChange accepts creatorIds for interactive moves", () => {
  const object = buildCampaignObjectFixture();
  const result = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      {
        creatorIds: ["cr_star"],
        fromWeek: 2,
        fromDayIndex: 0,
        toWeek: 3,
        toDayIndex: 2,
        deliverableTypes: ["1× IG Reel"],
      },
    ],
  });

  assert.ok(result.change?.includes("Nour Star"));
  const assignment = result.campaignObject.meta.mediaPlanSchedule?.assignments?.find(
    (entry) => entry.creatorId === "cr_star"
  );
  assert.equal(assignment?.week, 3);
  assert.equal(assignment?.dayIndex, 2);
});

test("applyMediaPlanScheduleChange pins remaining deliverables on partial moves", () => {
  const object = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
  });
  const creatorsData = object.sections.creators?.data as import("@/features/campaign-intelligence/types/section-schemas").CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× IG Set of stories"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
  }

  const result = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      {
        creatorIds: ["cr_star"],
        fromWeek: 2,
        fromDayIndex: 1,
        toWeek: 3,
        toDayIndex: 4,
        deliverableTypes: ["1× IG Reel"],
        remainingTypes: ["1× IG Set of stories"],
      },
    ],
  });

  const assignments = result.campaignObject.meta.mediaPlanSchedule?.assignments ?? [];
  const moved = assignments.find(
    (entry) => entry.creatorId === "cr_star" && entry.serviceType === "1× IG Reel"
  );
  const stayed = assignments.find(
    (entry) => entry.creatorId === "cr_star" && entry.serviceType === "1× IG Set of stories"
  );
  assert.equal(moved?.week, 3);
  assert.equal(moved?.dayIndex, 4);
  assert.equal(stayed?.week, 2);
  assert.equal(stayed?.dayIndex, 1);
});

test("drag move to week 1 updates publishing rhythm with launch rationale", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      durationWeeks: 4,
      platforms: ["TikTok", "Instagram"],
      rawBriefExcerpt:
        "Four-week summer launch — steady publishing across all weeks with even creator distribution.",
      objective: "Drive awareness for the summer launch",
    },
  });

  const before = buildMediaPlanStrategySummary(object);
  assert.ok(before.weekWeightRationale);
  assert.ok(!before.weekWeightRationale?.includes("calendar was refined"));

  const moved = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      { creatorIds: ["cr_star"], toWeek: 1, toDayIndex: 0 },
      { creatorIds: ["cr_macro1"], toWeek: 1, toDayIndex: 1 },
      { creatorIds: ["cr_macro2"], toWeek: 2, toDayIndex: 0 },
    ],
  }).campaignObject;

  const after = buildMediaPlanStrategySummary(moved);
  assert.ok(after.weekWeightRationale?.match(/W1|Week 1/i));
  assert.ok(after.weekWeightRationale?.match(/launch|momentum|front|awareness/i));
  assert.ok(after.weekWeights);
  assert.notEqual(after.weekWeightRationale, before.weekWeightRationale);
});

test("schedule move keeps asset delivery deadlines synced with calendar", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      durationWeeks: 4,
      platforms: ["Instagram", "TikTok"],
      campaignStartDate: "2026-08-03",
      rawBriefExcerpt: "Four-week summer launch with creators publishing across the calendar.",
      objective: "Drive awareness",
    },
  });

  const beforeData = mediaPlanData(generateMediaPlan(object));
  const beforeSlot = findCreatorSlot(beforeData, "cr_star");
  assert.ok(beforeSlot, "fixture should place cr_star on the calendar");
  assert.ok(beforeSlot.dayIndex >= 0);

  const toDayIndex = (beforeSlot.dayIndex + 2) % 7;
  const moved = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      {
        creatorIds: ["cr_star"],
        fromWeek: beforeSlot.week,
        fromDayIndex: beforeSlot.dayIndex,
        toWeek: beforeSlot.week,
        toDayIndex,
        deliverableTypes: beforeSlot.types.length ? beforeSlot.types : ["1× Instagram Reel"],
      },
    ],
  }).campaignObject;

  const { campaignObject: regenerated } = generateCampaignOutput(moved, "media_plan", {
    origin: "user",
  });
  const after = getOutputContentForDisplay(regenerated, "media_plan");
  assert.ok(after?.data);
  const afterData = after!.data as unknown as MediaPlanData;
  const afterSlot = findCreatorSlot(afterData, "cr_star");
  assert.ok(afterSlot);
  assert.equal(afterSlot.day, DAYS[toDayIndex]);
  assert.equal(afterSlot.week, beforeSlot.week);

  const deadline = afterData.deadlines.find(
    (row) =>
      row.creatorId === "cr_star" &&
      row.publishWeek === afterSlot.week &&
      row.publishDay === afterSlot.day
  );
  assert.ok(deadline, "deadlines should include the moved publish slot");
  assert.equal(deadline.publishDay, DAYS[toDayIndex]);
  assert.ok(deadline.assetDelivery);
  assert.ok(deadline.productionStart);

  const stale = afterData.deadlines.find(
    (row) =>
      row.creatorId === "cr_star" &&
      row.publishWeek === beforeSlot.week &&
      row.publishDay === beforeSlot.day &&
      beforeSlot.day !== afterSlot.day
  );
  assert.equal(stale, undefined, "old publish day deadline should not remain after move");
});

test("generateCampaignOutput after drag regenerates strategy in media plan output", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      durationWeeks: 4,
      rawBriefExcerpt:
        "Four-week campaign with even publishing weight across all weeks for sustained visibility.",
      objective: "Drive awareness",
      platforms: ["TikTok", "Instagram"],
    },
  });

  const moved = applyMediaPlanScheduleChange(object, {
    moveCreators: [
      { creatorIds: ["cr_star"], toWeek: 1, toDayIndex: 0 },
      { creatorIds: ["cr_macro1"], toWeek: 1, toDayIndex: 2 },
    ],
  }).campaignObject;

  const { campaignObject: regenerated } = generateCampaignOutput(moved, "media_plan", {
    origin: "user",
  });
  const content = generateMediaPlan(regenerated);
  const data = mediaPlanData(content);
  const rationale = data.strategySummary?.weekWeightRationale ?? "";

  assert.ok(rationale.match(/W1|Week 1/i));
  assert.ok(
    data.strategySummary?.narrative?.creativeRecommendations.length ||
      data.strategySummary?.creativeDirection?.length
  );
});

test("buildCreativeDirectionThemes combines TikTok and Instagram platform themes", () => {
  const object = buildCampaignObjectFixture({
    facts: {
      platforms: ["TikTok", "Instagram"],
      deliverables: ["12 Reels", "8 TikTok videos"],
      durationWeeks: 4,
    },
  });

  const themes = buildCreativeDirectionThemes(object, {
    platformAllocation: { TikTok: 8, Instagram: 12 },
    serviceTypes: ["Reels", "Stories"],
  });

  assert.ok(themes.some((theme) => /dance|lip-sync|trend/i.test(theme)));
  assert.ok(themes.some((theme) => /lifestyle|reels|stories/i.test(theme)));
  assert.ok(themes.some((theme) => /Nour Star/i.test(theme)));
});

test("detectWeightProfile classifies burst and sustain patterns", () => {
  assert.equal(detectWeightProfile([50, 20, 15, 15]), "burst");
  assert.equal(detectWeightProfile([25, 25, 25, 25]), "sustain");
  assert.equal(detectWeightProfile([10, 15, 20, 55]), "close");
});

test("buildPublishingRhythmRationale appends schedule adjustment note when brief present", () => {
  const rationale = buildPublishingRhythmRationale({
    weekWeights: [60, 25, 10, 5],
    baselineWeights: [25, 25, 25, 25],
    scheduleAdjusted: true,
    durationWeeks: 4,
    briefText: "Summer launch — front-load week 1.",
    objective: "Drive awareness",
  });

  assert.ok(rationale.match(/60%|W1 60%/i));
  assert.ok(rationale.match(/launch|momentum|awareness|front/i));
});

test("generateMediaPlan embeds strategy summary in structured data", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const data = mediaPlanData(content);
  assert.ok(data.strategySummary);
  assert.equal(data.strategySummary?.hasContent, true);
  assert.ok(
    data.strategySummary?.narrative?.creativeRecommendations.length ||
      data.strategySummary?.creativeDirection?.length
  );
});

test("buildMediaPlanHtml renders Campaign Strategy section with creative direction", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content);

  assert.ok(html.includes("Campaign Strategy"));
  assert.ok(html.includes("strat-card"));
  assert.ok(!html.includes('class="conf-pill medium"'));
  assert.ok(html.includes("obj-card"));
  assert.ok(html.includes("Executive Summary"));
  assert.ok(html.includes("Creative Recommendations"));
});
