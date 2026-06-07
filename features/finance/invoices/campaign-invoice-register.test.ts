/**
 * Run: npx tsx features/finance/invoices/campaign-invoice-register.test.ts
 */
import {
  isActiveInvoiceForFinancialTotals,
  isRegisterInvoiceStatus,
} from "@/lib/finance/status";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testDraftInvoiceEligibleForRegister() {
  assert(isRegisterInvoiceStatus("draft"), "draft is register status");
  assert(
    isActiveInvoiceForFinancialTotals({ status: "draft", regeneration_status: null }),
    "draft invoice counts in register"
  );
}

function testRegeneratedInvoiceExcludedFromRegister() {
  assert(
    !isActiveInvoiceForFinancialTotals({
      status: "draft",
      regeneration_status: "regenerated",
    }),
    "regenerated invoice excluded from register"
  );
}

const tests = [testDraftInvoiceEligibleForRegister, testRegeneratedInvoiceExcludedFromRegister];

for (const run of tests) {
  run();
}

console.log(`campaign-invoice-register: ${tests.length} passed`);
