/**
 * Run: npx tsx lib/finance/status/invoice-register-status-label.test.ts
 */
import { getInvoiceRegisterStatusLabel } from "@/lib/finance/status/invoice-status";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testIssuedAfterGenerateOrRegenerate() {
  assert(
    getInvoiceRegisterStatusLabel({ status: "draft", regeneration_status: "active" }) ===
      "Issued",
    "active draft shows Issued"
  );
  assert(
    getInvoiceRegisterStatusLabel({ status: "draft", regeneration_status: "regenerated" }) ===
      "Issued",
    "regenerated draft shows Issued in register"
  );
}

function testPendingAfterUngenerate() {
  assert(
    getInvoiceRegisterStatusLabel({
      status: "draft",
      regeneration_status: "pending_regeneration",
    }) === "Pending",
    "pending_regeneration draft shows Pending"
  );
}

function testFinanceStatusesUnchanged() {
  assert(getInvoiceRegisterStatusLabel({ status: "sent" }) === "Sent", "sent unchanged");
  assert(getInvoiceRegisterStatusLabel({ status: "paid" }) === "Paid", "paid unchanged");
}

const tests = [
  testIssuedAfterGenerateOrRegenerate,
  testPendingAfterUngenerate,
  testFinanceStatusesUnchanged,
];

for (const run of tests) {
  run();
}

console.log(`invoice-register-status-label: ${tests.length} passed`);
