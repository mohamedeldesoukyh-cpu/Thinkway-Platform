import assert from "node:assert/strict";
import test from "node:test";

import type { SlateCreator } from "./output-inputs";
import { expandSchedulableDeliverables, scheduleDeliverables } from "./media-plan-scheduler";
import { validateMediaPlanAgainstQuotation } from "./media-plan-pre-render-validation";
import { buildImmutableActivationsFromSlate } from "./media-plan-scheduler";

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

test("validation fails when scheduled story count exceeds quotation", () => {
  const slate = [creator("tbh", "Instagram TBH", ["1× IG Reel", "1× IG Set of stories"], "Macro")];
  const deliverables = expandSchedulableDeliverables(slate, ["Instagram"]);
  const activations = buildImmutableActivationsFromSlate(slate, ["Instagram"]);

  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });

  const result = validateMediaPlanAgainstQuotation({
    slate,
    placements,
    activations,
    durationWeeks: 4,
  });

  assert.equal(result.ok, true);
  const storyCheck = result.checks.find((check) => check.name.includes("ig set of stories"));
  assert.ok(storyCheck?.pass);
});

test("validation fails when invented UGC appears in schedule", () => {
  const slate = [creator("tbh", "Instagram TBH", ["1× IG Reel"], "Macro")];
  const deliverables = expandSchedulableDeliverables(slate, ["Instagram"]);
  const activations = buildImmutableActivationsFromSlate(slate, ["Instagram"]);
  const placements = scheduleDeliverables({
    deliverables,
    durationWeeks: 4,
    weekWeights: [70, 10, 10, 10],
  });

  placements[0]!.deliverable.role = "ugc";

  const result = validateMediaPlanAgainstQuotation({
    slate,
    placements,
    activations,
    durationWeeks: 4,
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /UGC integrity/i.test(error)));
});
