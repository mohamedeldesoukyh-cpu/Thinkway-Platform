/**
 * Run: npx tsx lib/billing/line-invoice-linkage.test.ts
 */
import { resolveConsensusLineInvoiceId } from "@/lib/billing/deliverable-billing";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testConsensusInvoiceIdWhenAllLocked() {
  const map = new Map([
    ["ili-1", "inv-1"],
    ["ili-2", "inv-1"],
  ]);
  const invoiceId = resolveConsensusLineInvoiceId(
    [
      { locked_at: "2026-01-01", invoice_line_item_id: "ili-1" },
      { locked_at: "2026-01-01", invoice_line_item_id: "ili-2" },
    ],
    map
  );
  assert(invoiceId === "inv-1", `expected inv-1, got ${invoiceId}`);
}

function testNoConsensusWhenPartiallyLocked() {
  const map = new Map([["ili-1", "inv-1"]]);
  const invoiceId = resolveConsensusLineInvoiceId(
    [
      { locked_at: "2026-01-01", invoice_line_item_id: "ili-1" },
      { locked_at: null, invoice_line_item_id: null },
    ],
    map
  );
  assert(invoiceId === null, `expected null, got ${invoiceId}`);
}

const tests = [testConsensusInvoiceIdWhenAllLocked, testNoConsensusWhenPartiallyLocked];

for (const run of tests) {
  run();
}

console.log(`line-invoice-linkage: ${tests.length} passed`);
