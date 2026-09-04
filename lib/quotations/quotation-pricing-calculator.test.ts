import assert from "node:assert/strict";
import {
  buildQuotationCalcPreview,
  quotationCalcNewClient,
  sumQuotationCalcPreview,
} from "./quotation-pricing-calculator";

// Defaults from pack QM
assert.equal(quotationCalcNewClient(200_000, "af", 25), 250_000);
assert.equal(quotationCalcNewClient(200_000, "gpm", 30), 200_000 / 0.7);
assert.equal(quotationCalcNewClient(200_000, "price", 300_000), 300_000);
assert.equal(quotationCalcNewClient(200_000, "gpv", 100_000), 300_000);

// Guard: gpm ≥ 100 holds at cost — never Infinity
assert.equal(quotationCalcNewClient(200_000, "gpm", 100), 200_000);
assert.equal(quotationCalcNewClient(200_000, "gpm", 150), 200_000);
assert.ok(Number.isFinite(quotationCalcNewClient(200_000, "gpm", 100)));

// Guard: price mode same figure on every line
const lines = [
  { id: "1", name: "A", handle: "a", optionNumber: 1, baseCost: 0, clientNow: 0 },
  {
    id: "2",
    name: "B",
    handle: "b",
    optionNumber: 1,
    baseCost: 200_000,
    clientNow: 200_000,
  },
  {
    id: "3",
    name: "C",
    handle: "c",
    optionNumber: 1,
    baseCost: 450_000,
    clientNow: 450_000,
  },
];
const priced = buildQuotationCalcPreview(lines, "price", 300_000, 14);
assert.ok(priced.every((r) => r.newClient === 300_000));

// Guard: below cost flags
const below = buildQuotationCalcPreview(
  [{ id: "1", name: "A", handle: "a", optionNumber: 1, baseCost: 450_000, clientNow: 450_000 }],
  "price",
  300_000,
  14
);
assert.equal(below[0]!.belowCost, true);
const totals = sumQuotationCalcPreview(below);
assert.equal(totals.hasBelowCost, true);
assert.equal(totals.clientPays, below[0]!.newClient + below[0]!.vat);

console.log("quotation-pricing-calculator.ts: ok");
