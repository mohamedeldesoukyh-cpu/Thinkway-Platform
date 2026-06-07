/**
 * Run: npx tsx lib/campaigns/operational-status-utils.test.ts
 */
import {
  operationalStatusForDb,
  normalizeOperationalStatusForOpsBadge,
} from "@/lib/campaigns/operational-status-utils";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testLockedMapsToInvoicedForDb() {
  assert(operationalStatusForDb("locked") === "invoiced", "locked -> invoiced");
}

function testIoRevisedMapsToReopenedForDb() {
  assert(operationalStatusForDb("io_revised") === "reopened", "io_revised -> reopened");
}

function testInvoicedDbMapsToLockedBadge() {
  assert(
    normalizeOperationalStatusForOpsBadge("invoiced") === "locked",
    "invoiced DB -> locked badge"
  );
}

const tests = [
  testLockedMapsToInvoicedForDb,
  testIoRevisedMapsToReopenedForDb,
  testInvoicedDbMapsToLockedBadge,
];

for (const run of tests) {
  run();
}

console.log(`operational-status-utils: ${tests.length} passed`);
