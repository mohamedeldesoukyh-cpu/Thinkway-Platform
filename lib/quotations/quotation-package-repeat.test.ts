import assert from "node:assert/strict";
import test from "node:test";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { repeatQuotationPackage, quotationPackageRepeat } from "./quotation-package-repeat";
import { rollupDeliverableCommercials } from "./quotation-deliverable-rollup";
import { fromDeliverableDrafts, toDeliverableDrafts } from "./quotation-deliverable-drafts";
const master = { cost: 100, revenue: 150, afPct: 10, costCurrency: "EGP", fxRateToEgp: 1 };
const row: QuotationDeliverable = { platform: "instagram", type: "instagram_reel", quantity: 1,
  type_lines: [{ type: "instagram_reel", quantity: 1 }, { type: "instagram_story", quantity: 2 }],
  cost: 100, revenue: 150, commercial_input_mode: "cost_revenue", af_pct: 10 };
const roll = (rows: QuotationDeliverable[]) => rollupDeliverableCommercials(rows, { lineCurrency: "EGP", fxRateToEgp: 1 });
test("repeating a fixed-price package preserves units and scales cost, revenue and fees through save/reload", () => {
  let rows = [row];
  for (const count of [2, 3, 1]) {
    rows = fromDeliverableDrafts(toDeliverableDrafts(repeatQuotationPackage(rows, count, master)));
    assert.equal(quotationPackageRepeat(rows), count);
    assert.equal(rows[0].cost, 100);
    assert.deepEqual(rows[0].type_lines, row.type_lines);
    const total = roll(rows)!;
    assert.equal(total.cost, 100 * count);
    assert.equal(total.revenue, 150 * count);
    assert.equal(total.afValue, 15 * count);
    assert.equal(total.totalClientCost / count, 165);
  }
});
test("master-only prices are seeded before repeating", () => {
  const rows = repeatQuotationPackage([{ ...row, cost: null, revenue: null }], 2, master);
  assert.equal(roll(rows)?.totalClientCost, 330);
  assert.equal(roll(rows)?.cost, 200);
});
test("markup and free packages keep their pricing semantics", () => {
  const markup = repeatQuotationPackage([{ ...row, commercial_input_mode: "cost_markup_pct" as const, gp_pct: 50 }], 2, master);
  assert.equal(roll(markup)?.totalClientCost, 330);
  const free = repeatQuotationPackage([{ ...row, free_for_client: true }], 2, master);
  assert.equal(roll(free)?.totalClientCost, 0);
  assert.equal(roll(free)?.cost, 200);
});
test("legacy mixed quantities are not presented as a shared unit price", () => {
  assert.equal(quotationPackageRepeat([row, { ...row, quantity: 2 }]), null);
});
