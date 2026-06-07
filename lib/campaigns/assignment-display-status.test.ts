/**
 * Run: npx tsx lib/campaigns/assignment-display-status.test.ts
 */
import { isAssignmentInvoiceSelectable } from "@/lib/billing/regeneration-eligibility";
import { effectiveAssignmentBillingStatusForUi } from "@/lib/campaigns/assignment-display-status";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testFullyInvoicedLineNotSelectable() {
  const selectable = isAssignmentInvoiceSelectable({
    billing_status: "invoiced",
    operational_status: "locked",
    vendor_io_id: "vio-1",
    active_vendor_io_id: "vio-1",
    vendor_io_document_number: "VIO-1",
    invoice_id: "inv-1",
    billable_amount: 3500,
    invoiced_amount: 3500,
    remaining_amount: 0,
  });
  assert(!selectable, "fully invoiced assignment should not show invoice checkbox");
}

function testNonIoLineShowsApprovedNotMovedToBilling() {
  const status = effectiveAssignmentBillingStatusForUi(
    {
      id: "line-new",
      billing_status: "moved_to_billing",
      operational_status: "draft",
      vendor_io_id: null,
      active_vendor_io_id: null,
      revenue: 4000,
      revenue_before_vat: 4000,
    } as never,
    {
      deliverable_count: 1,
      revenue: 4000,
      cost: 0,
      gp: 4000,
      margin_percent: 100,
      invoiced_value: 0,
      remaining_value: 4000,
      collected_value: 0,
    }
  );
  assert(status === "approved", "non-IO assignment must not show moved to billing");
}

function testPendingRegenerationStillSelectable() {
  const selectable = isAssignmentInvoiceSelectable({
    billing_status: "moved_to_billing",
    operational_status: "io_generated",
    vendor_io_id: "vio-1",
    active_vendor_io_id: "vio-1",
    vendor_io_document_number: "VIO-1",
    invoice_id: "inv-1",
    regeneration_status: "pending_regeneration",
    invoice_status: "draft",
    billable_amount: 3500,
    invoiced_amount: 3500,
    remaining_amount: 0,
  });
  assert(selectable, "pending regeneration remains selectable for billing regenerate");
}

const tests = [
  testFullyInvoicedLineNotSelectable,
  testNonIoLineShowsApprovedNotMovedToBilling,
  testPendingRegenerationStillSelectable,
];

for (const run of tests) {
  run();
}

console.log(`assignment-display-status: ${tests.length} passed`);
