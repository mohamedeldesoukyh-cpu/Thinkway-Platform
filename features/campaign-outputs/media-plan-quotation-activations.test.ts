import assert from "node:assert/strict";
import test from "node:test";

import type { SlateCreator } from "./output-inputs";
import {
  buildImmutableActivationsFromSlate,
  expandSchedulableDeliverables,
  scheduleDeliverables,
  validateScheduledPlacements,
} from "./media-plan-scheduler";
import { allocateDeliverablesThroughCampaignJourney } from "./media-plan-campaign-journey";
import { validateQuotationActivationContract } from "./media-plan-quotation-activations";

function creator(id: string, name: string, serviceTypes: string[], tier = "Macro"): SlateCreator {
  return {
    creatorId: id,
    displayName: name,
    tier,
    platform: "Instagram",
    serviceTypes,
    serviceLabel: serviceTypes.join(" · "),
  };
}

test("quotation contract preserves every purchased line", () => {
  const slate = [
    creator("farah", "Farah Roushdy", ["1× TT Video"], "Mega"),
    creator("hadir", "Hadir Elnahas", ["1× TT Video"], "Macro"),
    creator("tbh", "Instagram TBH", ["1× IG Reel", "1× IG Set of stories"], "Macro"),
  ];
  const activations = buildImmutableActivationsFromSlate(slate, ["TikTok", "Instagram"]);
  const validation = validateQuotationActivationContract(slate, activations);
  assert.equal(validation.ok, true);
  assert.equal(activations.length, 3);
  const tbh = activations.find((entry) => entry.creator.displayName === "Instagram TBH");
  assert.ok(tbh);
  assert.equal(tbh!.companionServiceTypes.length, 1);
  assert.match(tbh!.companionServiceTypes[0] ?? "", /stor/i);
});

test("IG Reel and Story Set bundle into one calendar activation", () => {
  const slate = [creator("tbh", "Instagram TBH", ["1× IG Reel", "1× IG Set of stories"], "Macro")];
  const deliverables = expandSchedulableDeliverables(slate, ["Instagram"]);
  assert.equal(deliverables.length, 1);
  assert.equal(deliverables[0]!.attachedCompanions.length, 1);
});

test("campaign journey does not put every creator in week 1", () => {
  const slate = [
    creator("m1", "Mega Launch", ["1× TT Video"], "Mega"),
    creator("m2", "Macro Two", ["1× TT Video"], "Macro"),
    creator("m3", "Macro Three", ["1× TT Video"], "Macro"),
    creator("m4", "Mid Four", ["1× TT Video"], "Mid"),
    creator("m5", "Mid Five", ["1× TT Video"], "Mid"),
    creator("m6", "Micro Six", ["1× TT Video"], "Micro"),
    creator("ugc", "UGC Seven", ["1× UGC"], "Nano"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const byWeek = allocateDeliverablesThroughCampaignJourney(deliverables, 4, {
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });
  const week1Count = (byWeek.get(1) ?? []).length;
  assert.ok(week1Count < deliverables.length, "week 1 should not schedule every activation");
  assert.ok(week1Count >= 1, "mega hero should still launch in week 1");
});

test("four-week quotation slate spreads 7 creators across all weeks with 70/10/10/10 weights", () => {
  const slate = [
    creator("farah", "Farah Roushdy", ["1× TT Video"], "Mega"),
    creator("hadi", "Hadi Elnahas", ["1× TT Video"], "Macro"),
    creator("reem", "Reem", ["1× TT Video"], "Mid"),
    creator("joumana", "Joumana", ["1× TT Video"], "Mid"),
    creator("nourhan", "Nourhan", ["1× TT Video"], "Mid"),
    creator("hany", "Hany", ["1× TT Video"], "Mid"),
    creator("tbh", "Instagram TBH", ["1× IG Reel", "1× IG Set of stories"], "Macro"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok", "Instagram"]);
  assert.equal(deliverables.length, 7);

  const byWeek = allocateDeliverablesThroughCampaignJourney(deliverables, 4, {
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });
  const weekCounts = [1, 2, 3, 4].map((week) => (byWeek.get(week) ?? []).length);
  assert.equal(weekCounts.reduce((sum, count) => sum + count, 0), 7);
  assert.ok(weekCounts.every((count) => count >= 1), `every week should carry activity: ${weekCounts.join(",")}`);
  assert.ok(weekCounts[0]! >= 2, "launch week should carry hero emphasis");

  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });
  const activations = buildImmutableActivationsFromSlate(slate, ["TikTok", "Instagram"]);
  const validation = validateScheduledPlacements({
    slate,
    placements,
    activations,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });
  assert.equal(validation.ok, true, validation.errors.join("; "));
});

test("mega hero pins to launch Monday in week 1 when available", () => {
  const slate = [creator("farah", "Farah Roushdy", ["1× TT Video"], "Mega")];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Launch awareness",
  });
  assert.equal(placements[0]!.week, 1);
  assert.equal(placements[0]!.dayIndex, 0);
});
