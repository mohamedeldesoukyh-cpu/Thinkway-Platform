/**
 * Run: npx tsx lib/finance/aging/compute-bucket.test.ts
 */
import {
  computeBucketFromDays,
  computeFinanceAgingBucket,
  computeFinanceAgingDays,
  daysSinceDate,
} from "@/lib/finance/aging/compute-bucket";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const AS_OF = new Date("2026-06-18T12:00:00");

function testBucketThresholds() {
  assert(computeBucketFromDays(0, 100) === "current", "zero days -> current");
  assert(computeBucketFromDays(-5, 100) === "current", "negative days -> current");
  assert(computeBucketFromDays(1, 100) === "1_30", "1 day -> 1_30");
  assert(computeBucketFromDays(30, 100) === "1_30", "30 days -> 1_30");
  assert(computeBucketFromDays(31, 100) === "31_60", "31 days -> 31_60");
  assert(computeBucketFromDays(61, 100) === "61_90", "61 days -> 61_90");
  assert(computeBucketFromDays(91, 100) === "90_plus", "91 days -> 90_plus");
}

function testInvoiceDateBasis() {
  const days = computeFinanceAgingDays(
    { issue_date: "2026-05-01", due_date: "2026-06-15" },
    "invoice_date",
    AS_OF
  );
  assert(days === 48, `invoice date aging expected 48, got ${days}`);
}

function testDueDateBasis() {
  const days = computeFinanceAgingDays(
    { issue_date: "2026-05-01", due_date: "2026-06-01" },
    "due_date",
    AS_OF
  );
  assert(days === 17, `due date aging expected 17, got ${days}`);
}

function testNotYetDueIsCurrent() {
  const bucket = computeFinanceAgingBucket(
    { issue_date: "2026-06-01", due_date: "2026-07-01" },
    500,
    "due_date",
    AS_OF
  );
  assert(bucket === "current", "not yet due should be current bucket");
}

function testSameDayInvoice() {
  assert(daysSinceDate("2026-06-18", AS_OF) === 0, "same day should be 0 days");
}

function run() {
  testBucketThresholds();
  testInvoiceDateBasis();
  testDueDateBasis();
  testNotYetDueIsCurrent();
  testSameDayInvoice();
  console.log("lib/finance/aging/compute-bucket.test.ts — all passed");
}

run();
