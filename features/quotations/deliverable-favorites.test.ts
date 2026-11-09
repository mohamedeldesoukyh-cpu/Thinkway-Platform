import assert from "node:assert/strict";
import { test } from "node:test";
import { validateDeliverableFavorites } from "./deliverable-favorites";

const favorite = { id: "test-one", name: "Reel and story", description: "Campaign package", lines: [{ type: "instagram_reel", quantity: 2 }, { type: "boosting", quantity: 1, period_months: 3 }] };
test("favorites retain types, quantities and duration without commercial amounts", () => {
  const result = validateDeliverableFavorites([{ ...favorite, cost: 999, lines: favorite.lines.map(line => ({ ...line, revenue: 500 })) }]);
  assert.equal(result[0].lines[0].quantity, 2);
  assert.equal(result[0].lines[1].period_months, 3);
  assert.equal(result[0].description, "Campaign package");
  assert(!("cost" in result[0]));
  assert(!("revenue" in result[0].lines[0]));
});
test("rejects invalid favorites and duplicated type selections", () => {
  assert.throws(() => validateDeliverableFavorites([{ ...favorite, lines: [] }]));
  assert.throws(() => validateDeliverableFavorites([{ ...favorite, lines: [favorite.lines[0], favorite.lines[0]] }]));
  assert.throws(() => validateDeliverableFavorites([{ ...favorite, lines: [{ type: "not-real", quantity: 1 }] }]));
  assert.throws(() => validateDeliverableFavorites([favorite, favorite]));
});
