/**
 * Run: npm run test:partial-assignment-invoice
 */
import assert from "node:assert/strict";

import {
  allocateSliceAcrossRemaining,
  applyCoverageToLedger,
  amountFromPercent,
  invoiceSliceKey,
  parseInvoiceSliceAllocations,
  percentFromAmount,
  resolveInvoiceSlice,
} from "@/lib/billing/partial-assignment-invoice";

function testPercentAndAmountStayLinked() {
  assert.equal(amountFromPercent(40_000, 50), 20_000);
  assert.equal(percentFromAmount(40_000, 20_000), 50);
  assert.equal(amountFromPercent(10_000, 100), 10_000);
}

function testDefaultIsAllRemaining() {
  const slice = resolveInvoiceSlice({ remaining: 40_000, invoiced: 0, billable: 40_000 });
  assert.equal(slice.billedAmount, 40_000);
  assert.equal(slice.remainingAfter, 0);
  assert.equal(slice.billingStatus, "invoiced");
  assert.equal(slice.shouldLock, true);
  assert.equal(slice.error, undefined);
}

function testFiftyPercentLeavesRemaining() {
  const slice = resolveInvoiceSlice({
    remaining: 40_000,
    invoiced: 0,
    billable: 40_000,
    requestedPercent: 50,
    vatPercent: 14,
  });
  assert.equal(slice.billedAmount, 20_000);
  assert.equal(slice.percentOfRemaining, 50);
  assert.equal(slice.remainingAfter, 20_000);
  assert.equal(slice.invoicedAfter, 20_000);
  assert.equal(slice.vatAmount, 2_800);
  assert.equal(slice.afterVat, 22_800);
  assert.equal(slice.billingStatus, "partially_invoiced");
  assert.equal(slice.shouldLock, false);
}

function testTypedAmountCapsAtRemaining() {
  const over = resolveInvoiceSlice({
    remaining: 8_000,
    invoiced: 32_000,
    billable: 40_000,
    requestedAmount: 12_500,
  });
  assert.equal(over.error, "Invoice amount cannot exceed remaining assignment revenue.");
  assert.equal(over.billedAmount, 0);

  const ok = resolveInvoiceSlice({
    remaining: 8_000,
    invoiced: 32_000,
    billable: 40_000,
    requestedAmount: 8_000,
  });
  assert.equal(ok.billedAmount, 8_000);
  assert.equal(ok.remainingAfter, 0);
  assert.equal(ok.shouldLock, true);
}

function testSecondInvoiceUsesRemainingNotOriginalTotal() {
  const second = resolveInvoiceSlice({
    remaining: 20_000,
    invoiced: 20_000,
    billable: 40_000,
    requestedPercent: 50,
  });
  assert.equal(second.billedAmount, 10_000);
  assert.equal(second.invoicedAfter, 30_000);
  assert.equal(second.remainingAfter, 10_000);
}

function testUnlimitedInvoicesUntilCap() {
  let remaining = 40_000;
  let invoiced = 0;
  for (const amount of [10_000, 10_000, 10_000, 10_000]) {
    const slice = resolveInvoiceSlice({
      remaining,
      invoiced,
      billable: 40_000,
      requestedAmount: amount,
    });
    assert.equal(slice.error, undefined);
    remaining = slice.remainingAfter;
    invoiced = slice.invoicedAfter;
  }
  assert.equal(remaining, 0);
  assert.equal(invoiced, 40_000);

  const blocked = resolveInvoiceSlice({
    remaining: 0,
    invoiced: 40_000,
    billable: 40_000,
    requestedAmount: 1,
  });
  assert.equal(blocked.error, "Nothing remaining to invoice on this row.");
}

function testExemptVatIsZeroOnSlice() {
  const slice = resolveInvoiceSlice({
    remaining: 10_000,
    requestedPercent: 50,
    vatPercent: 14,
    vatExempt: true,
  });
  assert.equal(slice.billedAmount, 5_000);
  assert.equal(slice.vatAmount, 0);
  assert.equal(slice.afterVat, 5_000);
}

function testLastCentIsAbsorbed() {
  const slice = resolveInvoiceSlice({
    remaining: 10.01,
    invoiced: 89.99,
    billable: 100,
    requestedAmount: 10,
  });
  assert.equal(slice.billedAmount, 10.01);
  assert.equal(slice.remainingAfter, 0);
}

function testCoverageLedgerFromLineItemSum() {
  const first = applyCoverageToLedger({ billable: 40_000, invoicedCoverage: 20_000 });
  assert.equal(first.invoiced, 20_000);
  assert.equal(first.remaining, 20_000);
  assert.equal(first.billingStatus, "partially_invoiced");
  assert.equal(first.shouldLock, false);

  const full = applyCoverageToLedger({ billable: 40_000, invoicedCoverage: 40_000 });
  assert.equal(full.remaining, 0);
  assert.equal(full.billingStatus, "invoiced");
  assert.equal(full.shouldLock, true);
}

function testUngenerateOneSliceLeavesOtherInvoices() {
  const afterRemove = applyCoverageToLedger({
    billable: 40_000,
    invoicedCoverage: 20_000,
  });
  assert.equal(afterRemove.invoiced, 20_000);
  assert.equal(afterRemove.remaining, 20_000);
  assert.equal(afterRemove.billingStatus, "partially_invoiced");
}

function testProRataAcrossChildren() {
  const shares = allocateSliceAcrossRemaining(20_000, [
    { id: "a", remaining: 30_000 },
    { id: "b", remaining: 10_000 },
  ]);
  assert.equal(shares.get("a"), 15_000);
  assert.equal(shares.get("b"), 5_000);
}

function testFourAssignmentMix() {
  const a = resolveInvoiceSlice({ remaining: 10_000, requestedPercent: 50, vatPercent: 14 });
  const b = resolveInvoiceSlice({ remaining: 8_000, requestedPercent: 50, vatPercent: 14 });
  const c = resolveInvoiceSlice({ remaining: 12_000, vatPercent: 14 });
  const d = resolveInvoiceSlice({ remaining: 6_000, requestedAmount: 6_000, vatPercent: 14 });
  assert.equal(a.billedAmount, 5_000);
  assert.equal(b.billedAmount, 4_000);
  assert.equal(c.billedAmount, 12_000);
  assert.equal(d.billedAmount, 6_000);
  assert.equal(roundVat(a.vatAmount + b.vatAmount + c.vatAmount + d.vatAmount), 3_780);
}

function testAllocationJsonRoundTrip() {
  const key = invoiceSliceKey("assignment", "11111111-1111-1111-1111-111111111111");
  const { allocations, error } = parseInvoiceSliceAllocations(
    JSON.stringify({ [key]: 12500.5 })
  );
  assert.equal(error, undefined);
  assert.equal(allocations.get(key), 12500.5);
}

function roundVat(value: number): number {
  return Math.round(value * 100) / 100;
}

const tests = [
  testPercentAndAmountStayLinked,
  testDefaultIsAllRemaining,
  testFiftyPercentLeavesRemaining,
  testTypedAmountCapsAtRemaining,
  testSecondInvoiceUsesRemainingNotOriginalTotal,
  testUnlimitedInvoicesUntilCap,
  testExemptVatIsZeroOnSlice,
  testLastCentIsAbsorbed,
  testCoverageLedgerFromLineItemSum,
  testUngenerateOneSliceLeavesOtherInvoices,
  testProRataAcrossChildren,
  testFourAssignmentMix,
  testAllocationJsonRoundTrip,
];

for (const run of tests) {
  run();
}

console.log(`partial-assignment-invoice: ${tests.length} passed`);
