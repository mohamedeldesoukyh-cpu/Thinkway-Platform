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
const breakEven = buildQuotationCalcPreview([lines[1]], "price", 200_000, 0);
assert.equal(sumQuotationCalcPreview(breakEven).hasBelowCost, false, "Break-even is allowed by the existing policy");
assert.equal(totals.clientPays, below[0]!.newClient + below[0]!.vat);

console.log("quotation-pricing-calculator.ts: ok");

const feeRows = buildQuotationCalcPreview([
  { id: "fee", name: "A", handle: null, optionNumber: 1, baseCost: 75000, clientNow: 95454.55, agencyFeePct: 10 },
  { id: "zero", name: "B", handle: null, optionNumber: 1, baseCost: 75000, clientNow: 95454.55, agencyFeePct: 0 },
], "price", 100000, 14);
assert.equal(feeRows[0].agencyFees, 10000);
assert.equal(feeRows[0].totalInvestment, 110000);
assert.equal(feeRows[0].vat, 15400);
assert.equal(feeRows[0].gp, 25000, "AF does not inflate commercial GP");
assert.equal(feeRows[1].agencyFees, 0);
assert.equal(sumQuotationCalcPreview(feeRows).clientPays, 239400);
