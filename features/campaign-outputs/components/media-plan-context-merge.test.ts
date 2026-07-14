import { strict as assert } from "node:assert";
import { test } from "node:test";

import { mergeMediaPlanContext } from "./media-plan-context-merge";

test("mergeMediaPlanContext prefers live override values over cached context", () => {
  const merged = mergeMediaPlanContext(
    { brandName: "Dolphin Tuna", clientName: "Old Client LLC" },
    { groupName: "Food Group", agencyName: "Media Agency Egypt", clientName: "Dolphin Foods LLC" }
  );

  assert.equal(merged?.brandName, "Dolphin Tuna");
  assert.equal(merged?.clientName, "Dolphin Foods LLC");
  assert.equal(merged?.groupName, "Food Group");
  assert.equal(merged?.agencyName, "Media Agency Egypt");
});

test("mergeMediaPlanContext returns undefined when all fields are empty", () => {
  assert.equal(mergeMediaPlanContext(undefined, undefined), undefined);
  assert.equal(mergeMediaPlanContext({}, {}), undefined);
});
