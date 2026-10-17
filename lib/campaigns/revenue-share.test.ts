import test from "node:test";
import assert from "node:assert/strict";
import { readRevenueShare, revenueShareAmount, allocateRevenueShare } from "./revenue-share";

const rates = new Map([["EGP", 1], ["USD", 50], ["AED", 14]]);
test("percentage follows total FX-adjusted revenue; fixed amount retains saved currency", () => {
  const percent = { mode: "percent" as const, value: 10, currency: "USD" };
  assert.equal(revenueShareAmount(percent, 1000, "EGP", rates), 100);
  assert.equal(revenueShareAmount(percent, 2000, "EGP", rates), 200);
  const fixed = { ...percent, mode: "amount" as const, value: 100 };
  assert.equal(revenueShareAmount(fixed, 1000, "USD", rates), 100);
  assert.equal(revenueShareAmount(fixed, 99999, "EGP", rates), 5000);
  assert.equal(revenueShareAmount(fixed, 99999, "AED", rates), 357.14);
  assert.throws(() => revenueShareAmount(fixed, 1000, "AED", new Map()), /Missing FX/);
});
test("live allocation is proportional, reconciles cents, and never deducts planned revenue", () => {
  assert.deepEqual(allocateRevenueShare(100, 1000, [500]), [50]);
  assert.deepEqual(allocateRevenueShare(100, 1000, [100, 400, 500]), [10, 40, 50]);
  assert.deepEqual(allocateRevenueShare(1, 3, [1, 1, 1]), [0.33, 0.34, 0.33]);
  assert.deepEqual(allocateRevenueShare(100, 0, [0]), [0]);
  assert.deepEqual(allocateRevenueShare(100, 1000, []), []);
});
test("empty campaigns default to no share; invalid saved data is not silently omitted", () => {
  assert.equal(readRevenueShare({}), null);
  assert.equal(revenueShareAmount(null, 1000, "EGP", rates), 0);
  assert.throws(() => readRevenueShare({ revenue_share: { mode: "amount", value: -1, currency: "EGP" } }));
});
