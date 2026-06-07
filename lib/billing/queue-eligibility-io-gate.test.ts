/**
 * Run: npx tsx lib/billing/queue-eligibility-io-gate.test.ts
 */
import { sumIoGatedAssignmentBillable } from "@/lib/billing/queue-eligibility";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assignmentRow(
  id: string,
  billable: number,
  vendorIoId: string | null
): OperationalBillingRow {
  return {
    id,
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: id,
    assignment_deliverable_id: null,
    parent_id: null,
    label: id,
    document_number: null,
    influencer_name: null,
    platform: null,
    deliverable_type: null,
    billable_amount: billable,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: billable,
    billing_status: "ready_to_invoice",
    line_billing_status: "moved_to_billing",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: true,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: billable,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    vendor_io_id: vendorIoId,
    children: [],
  };
}

function testSumIoGatedAssignmentBillable() {
  const rows = [
    assignmentRow("line-1", 5000, "io-1"),
    assignmentRow("line-2", 8500, "io-2"),
    assignmentRow("line-3", 4000, null),
  ];
  assert(sumIoGatedAssignmentBillable(rows) === 13500, "excludes line without IO");
}

testSumIoGatedAssignmentBillable();
console.log("queue-eligibility-io-gate.test.ts: ok");
