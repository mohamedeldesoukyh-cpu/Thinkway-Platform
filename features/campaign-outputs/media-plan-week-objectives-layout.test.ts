import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  weeklyObjectiveCardFlex,
  weeklyObjectiveWeightBarWidth,
} from "./media-plan-week-objectives-layout";

test("weeklyObjectiveCardFlex uses equal width so all cards fit page bounds", () => {
  assert.equal(weeklyObjectiveCardFlex(), "1 1 0");
});

test("weeklyObjectiveWeightBarWidth reflects calendar percentage inside cards", () => {
  assert.equal(weeklyObjectiveWeightBarWidth(70), "70%");
  assert.equal(weeklyObjectiveWeightBarWidth(10), "10%");
  assert.equal(weeklyObjectiveWeightBarWidth(150), "100%");
  assert.equal(weeklyObjectiveWeightBarWidth(-5), "0%");
});
