import assert from "node:assert/strict";
import test from "node:test";

import type { SlateCreator } from "./output-inputs";
import {
  buildSchedulingRationale,
  computeCreatorPriorityScore,
  computeDeliverablePriorityScore,
  sortDeliverablesForPhaseSlotAssignment,
} from "./media-plan-creator-priority";
import { parseCampaignObjectiveKind } from "./media-plan-priority-weights";
import {
  expandSchedulableDeliverables,
  scheduleDeliverables,
} from "./media-plan-scheduler";

function creator(
  id: string,
  name: string,
  serviceTypes: string[],
  tier = "Macro",
  extras: Partial<SlateCreator> = {}
): SlateCreator {
  return {
    creatorId: id,
    displayName: name,
    tier,
    platform: "TikTok",
    serviceTypes,
    serviceLabel: serviceTypes.join(" · "),
    ...extras,
  };
}

test("parseCampaignObjectiveKind maps awareness and engagement objectives", () => {
  assert.equal(parseCampaignObjectiveKind("Drive awareness and reach"), "awareness");
  assert.equal(parseCampaignObjectiveKind("Boost community engagement and UGC"), "engagement");
  assert.equal(parseCampaignObjectiveKind("Increase product education via tutorials"), "product_education");
});

test("high-follower macro ranks before micro for awareness on launch phase", () => {
  const macro = creator("macro", "Macro Star", ["1× TT Video"], "Macro", {
    followers: 800_000,
    engagementRate: 3.5,
  });
  const micro = creator("micro", "Micro Voice", ["1× TT Video"], "Micro", {
    followers: 45_000,
    engagementRate: 7.2,
  });

  const macroScore = computeCreatorPriorityScore(macro, {
    campaignObjective: "Drive awareness",
    phase: "launch",
  });
  const microScore = computeCreatorPriorityScore(micro, {
    campaignObjective: "Drive awareness",
    phase: "launch",
  });

  assert.ok(
    macroScore.score > microScore.score,
    `macro ${macroScore.score} should beat micro ${microScore.score} for awareness launch`
  );
  assert.ok(macroScore.reasons.some((reason) => /followers|reach|Macro/i.test(reason)));
});

test("engagement objective boosts mid-tier community creators over mega on momentum", () => {
  const mega = creator("mega", "Mega Anchor", ["1× TT Video"], "Mega", { followers: 2_000_000 });
  const mid = creator("mid", "Mid Community", ["1× TT Video"], "Mid-tier", {
    followers: 120_000,
    engagementRate: 8.5,
  });

  const megaScore = computeCreatorPriorityScore(mega, {
    campaignObjective: "Drive engagement and community participation",
    phase: "momentum",
  });
  const midScore = computeCreatorPriorityScore(mid, {
    campaignObjective: "Drive engagement and community participation",
    phase: "momentum",
  });

  assert.ok(
    midScore.score > megaScore.score,
    `mid ${midScore.score} should beat mega ${megaScore.score} for engagement momentum`
  );
});

test("scheduler order is not quotation order when creator scores differ", () => {
  const slate = [
    creator("c1", "Alpha Micro", ["1× TT Video"], "Micro", { followers: 30_000 }),
    creator("c2", "Beta Mega", ["1× TT Video"], "Mega", { followers: 1_500_000 }),
    creator("c3", "Gamma Macro", ["1× TT Video"], "Macro", { followers: 600_000 }),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });

  const byLaunchDay = [...placements].sort((a, b) => a.absoluteDay - b.absoluteDay);

  const placementOrder = placements.map((placement) => placement.deliverable.creator.creatorId);
  const quotationOrder = slate.map((entry) => entry.creatorId);

  assert.notDeepEqual(
    placementOrder,
    quotationOrder,
    "scheduler should not preserve quotation order when scores differ"
  );
  assert.equal(
    byLaunchDay[0]!.deliverable.creator.creatorId,
    "c2",
    "mega hero should receive the earliest publish slot"
  );
});

test("all activations still placed and quotation counts unchanged under priority ranking", () => {
  const slate = [
    creator("c1", "Coach A", ["2× TT Video", "1× Mirrored IG"]),
    creator("c2", "Coach B", ["1× TT Video"], "Mega", { followers: 900_000 }),
    creator("c3", "Coach C", ["1× TT Video"], "Micro"),
  ];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  assert.equal(deliverables.length, 4);

  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });

  assert.equal(placements.length, 4);
  assert.equal(new Set(placements.map((p) => p.deliverable.slotId)).size, 4);
});

test("schedulingRationale is attached with score and phase", () => {
  const slate = [creator("hero", "Launch Hero", ["1× TT Video"], "Mega", { followers: 1_200_000 })];
  const deliverables = expandSchedulableDeliverables(slate, ["TikTok"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
    campaignObjective: "Drive awareness",
  });

  const rationale = placements[0]!.schedulingRationale;
  assert.ok(rationale);
  assert.equal(rationale!.creatorId, "hero");
  assert.ok(rationale!.score > 0);
  assert.ok(rationale!.reasons.length > 0);
  assert.match(rationale!.phase, /Launch|Amplification|Momentum|Wrap-up|Community|UGC/i);
});

test("buildSchedulingRationale produces explainability payload", () => {
  const deliverable = expandSchedulableDeliverables(
    [creator("x", "Test", ["1× TT Video"], "Macro")],
    ["TikTok"]
  )[0]!;
  const result = computeDeliverablePriorityScore(deliverable, {
    campaignObjective: "Drive awareness",
    phase: "launch",
  });
  const rationale = buildSchedulingRationale(deliverable, result, "launch", 1);
  assert.equal(rationale.creatorId, "x");
  assert.equal(rationale.slotRank, 1);
  assert.ok(rationale.score > 0);
});

test("sortDeliverablesForPhaseSlotAssignment ranks by score within a week phase", () => {
  const deliverables = expandSchedulableDeliverables(
    [
      creator("low", "Low", ["1× TT Video"], "Nano"),
      creator("high", "High", ["1× TT Video"], "Mega", { followers: 2_000_000 }),
    ],
    ["TikTok"]
  );
  const sorted = sortDeliverablesForPhaseSlotAssignment(deliverables, "launch", {
    campaignObjective: "Drive awareness",
  });
  assert.equal(sorted[0]!.deliverable.creator.creatorId, "high");
});
