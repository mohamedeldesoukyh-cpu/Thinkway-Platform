import assert from "node:assert/strict";
import test from "node:test";

import type { SlateCreator } from "./output-inputs";
import {
  allocateCountByWeights,
  normalizeWeekWeights,
} from "./media-plan-schedule";
import {
  countDeliverablesPerWeek,
  expandSchedulableDeliverables,
  expandRawSchedulableDeliverables,
  orderDeliverablesForWeekAllocation,
  orderDeliverablesForOptimization,
  parseServiceTypeQuantity,
  publishingScore,
  publishingScorePerWeek,
  scheduleDeliverables,
} from "./media-plan-scheduler";
import {
  briefAllowsEarlyUgc,
  isMirrorServiceType,
  isUgcServiceType,
  resolveUgcEarliestWeek,
} from "./media-plan-deliverable-classification";
import { generateMediaPlan, type MediaPlanData } from "./generators/media-plan";
import { buildCampaignObjectFixture } from "./output-test-fixture";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

function creator(id: string, name: string, serviceTypes: string[], tier = "Macro"): SlateCreator {
  return {
    creatorId: id,
    displayName: name,
    tier,
    platform: "TikTok",
    serviceTypes,
    serviceLabel: serviceTypes.join(" · "),
  };
}

test("parseServiceTypeQuantity expands multi-quantity lines", () => {
  assert.deepEqual(parseServiceTypeQuantity("2× TT Video"), {
    quantity: 2,
    baseLabel: "TT Video",
  });
  assert.deepEqual(parseServiceTypeQuantity("1× IG Reel"), {
    quantity: 1,
    baseLabel: "IG Reel",
  });
});

test("expandSchedulableDeliverables splits 2× TikTok into two units", () => {
  const slate = [creator("c1", "Coach A", ["2× TT Video"])];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  assert.equal(deliverables.length, 2);
  assert.equal(deliverables[0]!.serviceType, "1× TT Video");
  assert.equal(deliverables[1]!.serviceType, "1× TT Video");
  assert.equal(deliverables[0]!.deliverableIndex, 1);
  assert.equal(deliverables[1]!.deliverableIndex, 2);
});

test("mirror detection and collapse — 2× TT + 1× Mirrored IG = 2 activations", () => {
  const slate = [creator("c1", "Coach A", ["2× TT Video", "1× Mirrored IG"])];
  const raw = expandRawSchedulableDeliverables(slate, ["TikTok"]);
  assert.equal(raw.length, 3);
  assert.ok(isMirrorServiceType("1× Mirrored IG"));

  const activations = expandSchedulableDeliverables(slate, ["TikTok"]);
  assert.equal(activations.length, 2);
  const hostWithMirror = activations.find((entry) => entry.attachedMirrors.length > 0);
  assert.ok(hostWithMirror);
  assert.equal(hostWithMirror!.attachedMirrors[0]!.serviceType, "1× Mirrored IG");

  const placements = scheduleDeliverables({
    deliverables: activations,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });
  assert.equal(placements.length, 2);
  const mirrorHostDay = placements.find((placement) => placement.deliverable.attachedMirrors.length > 0);
  assert.ok(mirrorHostDay);
  assert.equal(
    mirrorHostDay!.deliverable.attachedMirrors[0]!.serviceType,
    "1× Mirrored IG"
  );
});

test("UGC creator scheduled in week 3-4 not week 1 on default 4-week launch", () => {
  const slate = [
    creator("hero", "Mega Hero", ["1× TT Video"], "Mega"),
    creator("ugc", "Community UGC", ["1× UGC"], "Nano"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok", "Instagram"]);
  assert.ok(isUgcServiceType("1× UGC"));

  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });

  const ugcPlacement = placements.find((placement) => placement.deliverable.role === "ugc");
  assert.ok(ugcPlacement);
  assert.ok(ugcPlacement!.week >= 3, `UGC should land in W3+, got W${ugcPlacement!.week}`);
});

test("UGC allowed in week 1 when brief requests immediate UGC", () => {
  const slate = [creator("ugc", "Community UGC", ["1× UGC"], "Nano")];
  const deliverables = expandSchedulableDeliverables(slate, ["Instagram"]);
  const brief = "We need immediate UGC from day 1 to seed the challenge feed.";

  assert.ok(briefAllowsEarlyUgc(brief));
  assert.equal(resolveUgcEarliestWeek(4, brief), 1);

  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    briefText: brief,
  });

  assert.equal(placements[0]!.week, 1);
});

test("70/10/10/10 weights emphasize week 1 impact while sustaining activity in every week", () => {
  const slate = [
    creator("c1", "Coach A", ["2× TT Video", "1× Mirrored IG"]),
    ...Array.from({ length: 6 }, (_, index) =>
      creator(`c${index + 2}`, `Creator ${index + 2}`, ["1× TT Video"])
    ),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  assert.equal(deliverables.length, 8);

  const counts = countDeliverablesPerWeek(slate, 4, { weekWeights: [70, 10, 10, 10] });
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 8);
  assert.ok(counts[0]! >= 2, `week 1 should lead but not absorb the campaign, got ${counts[0]}`);
  assert.ok(counts.every((count) => count >= 1), `every week should carry activity: ${counts.join(",")}`);

  const scoreByWeek = publishingScorePerWeek(slate, 4, { weekWeights: [70, 10, 10, 10] });
  assert.ok(scoreByWeek[0]! >= scoreByWeek[1]!);
  assert.ok(scoreByWeek[0]! >= scoreByWeek[3]!);
});

test("70/10/10/10 continuous targets spread 7 activations across 4 weeks", () => {
  const weights = normalizeWeekWeights([70, 10, 10, 10], 4);
  const slate = Array.from({ length: 7 }, (_, index) =>
    creator(`c${index}`, `Creator ${index}`, ["1× TT Video"], index === 0 ? "Mega" : "Mid")
  );
  const counts = countDeliverablesPerWeek(slate, 4, { weekWeights: weights });
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 7);
  assert.ok(counts.every((count) => count >= 1));
  assert.ok(counts[0]! >= 2);
});

test("2× TikTok creator splits across weeks under launch-heavy weights", () => {
  const slate = [creator("c1", "Coach A", ["2× TT Video"])];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });

  assert.equal(placements.length, 2);
  const weeks = placements.map((placement) => placement.week).sort((a, b) => a - b);
  assert.notEqual(weeks[0], weeks[1], "second TikTok should land in a later week");
  assert.equal(weeks[0], 1, "first TikTok should launch in week 1");
});

test("scheduler never places two deliverables from same creator on same day", () => {
  const slate = [
    creator("c1", "Coach A", ["2× TT Video", "1× TikTok Story"]),
    creator("c2", "Coach B", ["1× TT Video"]),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });

  const byCreatorDay = new Map<string, number>();
  for (const placement of placements) {
    const key = `${placement.deliverable.creator.creatorId}:${placement.absoluteDay}`;
    byCreatorDay.set(key, (byCreatorDay.get(key) ?? 0) + 1);
  }
  assert.ok([...byCreatorDay.values()].every((count) => count === 1));
});

test("orderDeliverablesForWeekAllocation interleaves first posts before second posts", () => {
  const slate = [
    creator("c1", "A", ["2× TT Video"]),
    creator("c2", "B", ["1× TT Video"]),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const ordered = orderDeliverablesForWeekAllocation(deliverables);
  assert.equal(ordered[0]!.creator.creatorId, "c1");
  assert.equal(ordered[0]!.creatorRound, 0);
  assert.equal(ordered[1]!.creator.creatorId, "c2");
  assert.equal(ordered[2]!.creator.creatorId, "c1");
  assert.equal(ordered[2]!.creatorRound, 1);
});

test("orderDeliverablesForOptimization prioritizes heroes before reinforcement", () => {
  const slate = [
    creator("mega", "Mega Hero", ["2× TT Video"], "Mega"),
    creator("macro", "Macro Voice", ["1× TT Video"], "Macro"),
    creator("ugc", "Community UGC", ["1× UGC"], "Nano"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const ordered = orderDeliverablesForOptimization(deliverables);
  assert.equal(ordered[0]!.creator.creatorId, "mega");
  assert.equal(ordered[0]!.creatorRound, 0);
  assert.ok(ordered.findIndex((entry) => entry.role === "ugc") > 0);
});

test("publishingScore ranks tiers for optimization", () => {
  const mega = creator("m", "Mega", ["1× TT Video"], "Mega");
  const macro = creator("a", "Macro", ["1× TT Video"], "Macro");
  const ugc = creator("u", "UGC", ["1× UGC"], "Nano");
  const [megaUnit, macroUnit, ugcUnit] = expandSchedulableDeliverables([mega, macro, ugc], ["TikTok"]);
  assert.equal(publishingScore(megaUnit!), 100);
  assert.equal(publishingScore(macroUnit!), 85);
  assert.equal(publishingScore(ugcUnit!), 40);
});

test("scheduler leaves breathing room — not every day in a week has content", () => {
  const slate = Array.from({ length: 5 }, (_, index) =>
    creator(`c${index}`, `Creator ${index}`, ["1× TT Video"], "Macro")
  );
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });

  const daysUsedWeek1 = new Set(
    placements.filter((placement) => placement.week === 1).map((placement) => placement.dayIndex)
  );
  assert.ok(daysUsedWeek1.size < 7, "week 1 should not fill every calendar day");
  assert.ok(daysUsedWeek1.size >= 2, "week 1 should still carry launch density");
});

test("scheduler never stacks two Mega creators on the same day", () => {
  const slate = [
    creator("m1", "Mega One", ["1× TT Video"], "Mega"),
    creator("m2", "Mega Two", ["1× TT Video"], "Mega"),
    creator("m3", "Mega Three", ["1× TT Video"], "Celebrity"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });

  const megaDays = new Map<number, number>();
  for (const placement of placements) {
    if (placement.deliverable.tierRank > 1) continue;
    megaDays.set(placement.absoluteDay, (megaDays.get(placement.absoluteDay) ?? 0) + 1);
  }
  assert.ok([...megaDays.values()].every((count) => count === 1));
});

test("countDeliverablesPerWeek sustains activity in every week under launch-heavy weights", () => {
  const slate = Array.from({ length: 8 }, (_, index) =>
    creator(`c${index}`, `Creator ${index}`, ["1× TT Video"])
  );
  const counts = countDeliverablesPerWeek(slate, 4, { weekWeights: [70, 10, 10, 10] });
  assert.ok(counts[0]! >= counts[1]!);
  assert.ok(counts.every((count) => count >= 1));
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 8);
});

test("media plan groups mirror under primary creator card on same day", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
  });
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
    reasoning[0].quotedRevenue = 120_000;
    reasoning[0].quotedCurrency = "EGP";
  }
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const data = generateMediaPlan(obj).data as MediaPlanData;
  const nourDays = data.weeks.flatMap((week) =>
    week.days.filter(
      (day) =>
        day.creator === "Nour Star" ||
        day.additionalDeliverables?.some((entry) => entry.creator === "Nour Star" && !entry.isMirror)
    )
  );

  assert.equal(nourDays.length, 1, "IG Reel + Stories + Mirror = 1 strategic activation day");
  assert.equal(data.postingSlotCount, 1);

  const reelDay = nourDays[0]!;
  const mirrorOnReelDay = reelDay.additionalDeliverables?.find((entry) => entry.isMirror);
  assert.ok(mirrorOnReelDay, "Mirrored IG should nest under the reel activation");
  assert.match(mirrorOnReelDay!.serviceType ?? "", /Mirror/i);
  const storyCompanion = reelDay.additionalDeliverables?.find((entry) => entry.isCompanion);
  assert.ok(storyCompanion, "IG Story Set should publish on the same day as the Reel");
});

test("2× TikTok creator schedules on different days with 70/10/10/10 weights", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: [{ id: "cr_tt", name: "TikTok Hero", tier: "Macro" }],
  });
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].platform = "TikTok";
    reasoning[0].serviceTypes = ["2× TT Video"];
    reasoning[0].serviceLabel = "2× TT Video";
    reasoning[0].quotedRevenue = 50_000;
    reasoning[0].quotedCurrency = "EGP";
  }
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const data = generateMediaPlan(obj).data as MediaPlanData;
  const heroDays = data.weeks.flatMap((week) =>
    week.days
      .filter((day) => day.creator === "TikTok Hero" || day.additionalDeliverables?.some((e) => e.creator === "TikTok Hero"))
      .map((day) => ({
        week: week.week,
        day: day.day,
        serviceType: day.creator === "TikTok Hero" ? day.serviceType : day.additionalDeliverables?.find((e) => e.creator === "TikTok Hero")?.serviceType,
      }))
  );

  assert.equal(heroDays.length, 2);
  assert.match(heroDays[0]!.serviceType ?? "", /TT Video/);
  assert.match(heroDays[1]!.serviceType ?? "", /TT Video/);
  assert.notEqual(`${heroDays[0]!.week}-${heroDays[0]!.day}`, `${heroDays[1]!.week}-${heroDays[1]!.day}`);
  assert.equal(heroDays[0]!.week, 1);
  assert.ok(heroDays[1]!.week! > 1);
  assert.equal(data.postingSlotCount, 2);
});
