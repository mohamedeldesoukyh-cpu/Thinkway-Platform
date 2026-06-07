/**
 * Run: npx tsx lib/billing/invoice-ungenerate-eligibility.test.ts
 */
import {
  isInvoiceUngenerateEligible,
} from "@/lib/billing/invoice-ungenerate-eligibility";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testDraftInvoicedInvoiceCanUngenerate() {
  assert(
    isInvoiceUngenerateEligible({
      status: "draft",
      regeneration_status: "active",
      is_operational_locked: false,
    }),
    "draft invoiced invoice remains ungeneratable"
  );
}

function testFinanceLockedDraftCannotUngenerate() {
  assert(
    !isInvoiceUngenerateEligible({
      status: "draft",
      regeneration_status: "active",
      is_operational_locked: true,
    }),
    "finance-locked draft cannot ungenerate"
  );
}

const tests = [testDraftInvoicedInvoiceCanUngenerate, testFinanceLockedDraftCannotUngenerate];

for (const run of tests) {
  run();
}

console.log(`invoice-ungenerate-eligibility: ${tests.length} passed`);
