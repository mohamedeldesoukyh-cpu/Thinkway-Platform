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
  orderDeliverablesForWeekAllocation,
  parseServiceTypeQuantity,
  scheduleDeliverables,
} from "./media-plan-scheduler";
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

test("70/10/10/10 weights allocate ~70% of deliverables to week 1", () => {
  const weights = normalizeWeekWeights([70, 10, 10, 10], 4);
  const counts = allocateCountByWeights(14, weights);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 14);
  assert.ok(counts[0]! >= 9, `expected week 1 to hold ~70%, got ${counts[0]}`);
  assert.ok(counts[0]! > counts[1]! + counts[2]! + counts[3]!);
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

test("countDeliverablesPerWeek honors 70/10/10/10 on a multi-creator slate", () => {
  const slate = Array.from({ length: 8 }, (_, index) =>
    creator(`c${index}`, `Creator ${index}`, ["1× TT Video"])
  );
  const counts = countDeliverablesPerWeek(slate, 4, { weekWeights: [70, 10, 10, 10] });
  assert.ok(counts[0]! > counts[1]!);
  assert.ok(counts[0]! > counts[3]!);
  assert.equal(counts.reduce((sum, count) => sum + count, 0), 8);
});

test("media plan places each deliverable on its own day card for multi-type creator", () => {
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
  const nourSlots = data.weeks.flatMap((week) =>
    week.days.flatMap((day) => {
      const slots: Array<{ week: number; day: string; serviceType?: string }> = [];
      if (day.creator === "Nour Star") {
        slots.push({ week: week.week, day: day.day, serviceType: day.serviceType });
      }
      for (const extra of day.additionalDeliverables ?? []) {
        if (extra.creator === "Nour Star") {
          slots.push({ week: week.week, day: day.day, serviceType: extra.serviceType });
        }
      }
      return slots;
    })
  );

  assert.equal(nourSlots.length, 3);
  const uniqueDays = new Set(nourSlots.map((slot) => `${slot.week}-${slot.day}`));
  assert.equal(uniqueDays.size, 3, "each deliverable should have its own calendar day");
  assert.deepEqual(
    nourSlots.map((slot) => slot.serviceType).sort(),
    ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"].sort()
  );
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
  assert.equal(heroDays[0]!.serviceType, "1× TT Video");
  assert.equal(heroDays[1]!.serviceType, "1× TT Video");
  assert.notEqual(`${heroDays[0]!.week}-${heroDays[0]!.day}`, `${heroDays[1]!.week}-${heroDays[1]!.day}`);
  assert.equal(heroDays[0]!.week, 1);
  assert.ok(heroDays[1]!.week! > 1);
  assert.equal(data.postingSlotCount, 2);
});
