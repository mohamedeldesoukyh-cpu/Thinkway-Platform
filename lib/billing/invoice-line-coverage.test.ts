/**
 * Run: npx tsx lib/billing/invoice-line-coverage.test.ts
 */
import {
  resolveExpectedLineBillable,
  sumInvoiceLineRevenueForCampaignLine,
} from "@/lib/billing/invoice-from-deliverables";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testResolveExpectedLineBillableFallsBackToLineRevenue() {
  const expected = resolveExpectedLineBillable(
    { id: "line-b", revenue: 3500, revenue_before_vat: 3500 },
    []
  );
  assert(expected === 3500, "package line billable uses campaign line revenue");
}

function testCoverageGapDetectsMissingPackageLine() {
  const invoiced = sumInvoiceLineRevenueForCampaignLine(
    [{ campaign_line_id: "line-a", revenue_before_vat: 10000 }],
    "line-b"
  );
  assert(invoiced === 0, "missing assignment line has zero invoiced coverage");
}

const tests = [
  testResolveExpectedLineBillableFallsBackToLineRevenue,
  testCoverageGapDetectsMissingPackageLine,
];

for (const run of tests) {
  run();
}

console.log(`invoice-line-coverage: ${tests.length} passed`);
