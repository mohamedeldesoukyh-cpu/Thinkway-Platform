/**
 * Run: npx tsx lib/finance/invoice-registry.test.ts
 */
import { getInvoiceOperationalState } from "@/lib/finance/invoice-registry";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testDraftInvoicedShowsOpenUntilFinanceLock() {
  const state = getInvoiceOperationalState({
    status: "draft",
    regeneration_status: "active",
    is_operational_locked: false,
  });
  assert(state.locked_status === "Open", "draft invoiced invoice stays open until finance lock");
}

function testSentInvoiceShowsLocked() {
  const state = getInvoiceOperationalState({
    status: "sent",
    regeneration_status: "active",
    is_operational_locked: false,
  });
  assert(state.locked_status === "Locked", "sent invoice shows locked");
}

function testPendingRegenerationWhenUnlocked() {
  const state = getInvoiceOperationalState({
    status: "draft",
    regeneration_status: "pending_regeneration",
    is_operational_locked: false,
  });
  assert(
    state.locked_status === "Pending regeneration",
    "unlocked pending_regeneration shows pending label"
  );
}

function testVoidDoesNotStayPending() {
  const state = getInvoiceOperationalState({
    status: "void",
    regeneration_status: "pending_regeneration",
    is_operational_locked: false,
  });
  assert(state.locked_status !== "Pending regeneration", "void is not pending regeneration");
  assert(state.is_void, "void flag set");
}

const tests = [
  testDraftInvoicedShowsOpenUntilFinanceLock,
  testSentInvoiceShowsLocked,
  testPendingRegenerationWhenUnlocked,
  testVoidDoesNotStayPending,
];

for (const run of tests) {
  run();
}

console.log(`invoice-registry: ${tests.length} passed`);
