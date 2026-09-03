import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeProposedRevenue,
  previewPricingCalculatorLines,
} from "@/lib/campaigns/assignment-pricing-calculator";

test("calculator modes match spec formulas", () => {
  assert.equal(computeProposedRevenue(100, "af", 50), 150);
  assert.equal(computeProposedRevenue(65, "gpm", 35), 100);
  assert.equal(computeProposedRevenue(100, "pr", 300), 300);
  assert.equal(computeProposedRevenue(100, "gpv", 40), 140);
  assert.equal(computeProposedRevenue(80, "gpm", 100), 80);
});

test("preview flags lines priced below cost", () => {
  const rows = previewPricingCalculatorLines(
    [{ lineId: "a", cost: 100, revenue: 120, vatPercent: 14 }],
    "pr",
    50
  );
  assert.equal(rows[0]?.belowCost, true);
  assert.equal(rows[0]?.newRevenue, 50);
});
