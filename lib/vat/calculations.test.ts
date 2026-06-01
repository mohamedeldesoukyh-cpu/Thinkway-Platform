/**
 * Manual VAT calculation checks — run with: npx tsx lib/vat/calculations.test.ts
 */
import {
  aggregateInvoiceTotals,
  computeNetVatPayable,
  computeOperationalGp,
  computeVatLine,
} from "./calculations";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function testEgyptInvoice() {
  const line = computeVatLine({ beforeVat: 1000, vatPercent: 14 });
  assert(line.vatAmount === 140, "Egypt VAT amount should be 140");
  assert(line.afterVat === 1140, "Egypt total should be 1140");
}

function testVatExemptInvoice() {
  const line = computeVatLine({ beforeVat: 1000, vatPercent: 14, exempt: true });
  assert(line.vatAmount === 0, "Exempt invoice VAT should be 0");
  assert(line.afterVat === 1000, "Exempt total should equal subtotal");
}

function testRegisteredCreator() {
  const cost = computeVatLine({ beforeVat: 500, vatPercent: 14 });
  assert(cost.vatAmount === 70, "Registered creator input VAT should be 70");
}

function testNonVatCreator() {
  const cost = computeVatLine({ beforeVat: 500, vatPercent: 0 });
  assert(cost.vatAmount === 0, "Non-VAT creator should have zero input VAT");
}

function testGpExcludesVat() {
  const revenue = computeVatLine({ beforeVat: 1000, vatPercent: 14 });
  const cost = computeVatLine({ beforeVat: 500, vatPercent: 14 });
  const { gp, marginPercent } = computeOperationalGp(
    revenue.beforeVat,
    cost.beforeVat
  );
  assert(gp === 500, "GP must exclude VAT");
  assert(marginPercent === 50, "Margin must be 50% ex-VAT");
}

function testSettlement() {
  const output = 140;
  const input = 70;
  assert(computeNetVatPayable(output, input) === 70, "Net VAT payable should be 70");
}

function testMixedInvoiceTotals() {
  const totals = aggregateInvoiceTotals([
    computeVatLine({ beforeVat: 1000, vatPercent: 14 }),
    computeVatLine({ beforeVat: 200, vatPercent: 0, exempt: true }),
  ]);
  assert(totals.subtotal === 1200, "Invoice subtotal should be 1200 ex-VAT");
  assert(totals.taxAmount === 140, "Invoice tax should be 140");
  assert(totals.total === 1340, "Invoice total should be 1340");
}

const tests = [
  testEgyptInvoice,
  testVatExemptInvoice,
  testRegisteredCreator,
  testNonVatCreator,
  testGpExcludesVat,
  testSettlement,
  testMixedInvoiceTotals,
];

for (const test of tests) {
  test();
}

console.log(`All ${tests.length} VAT calculation checks passed.`);
