/**
 * Run: npx tsx lib/campaigns/sync-campaign-header-status.test.ts
 */
import {
  deriveCampaignHeaderStatus,
  isCampaignFullyInvoiced,
  isClientIoGenerated,
  isVendorIoGenerated,
  shouldAutoSyncCampaignHeaderStatus,
} from "@/lib/campaigns/sync-campaign-header-status";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assignmentRow(
  overrides: Partial<OperationalBillingRow> = {}
): OperationalBillingRow {
  return {
    id: "line-1",
    kind: "assignment",
    label: "Assignment",
    campaign_line_id: "line-1",
    billing_status: "invoiced",
    line_billing_status: "invoiced",
    operational_status: "locked",
    billable_amount: 1000,
    invoiced_amount: 1000,
    collected_amount: 0,
    remaining_amount: 0,
    is_locked: true,
    is_achieved: true,
    vendor_io_id: "vio-1",
    children: [],
    ...overrides,
  } as OperationalBillingRow;
}

function testClientIoGeneratedRequiresDocumentTimestamp() {
  assert(!isClientIoGenerated(null), "missing client IO is not generated");
  assert(
    !isClientIoGenerated({ document_generated_at: null }),
    "client IO without document is not generated"
  );
  assert(
    isClientIoGenerated({ document_generated_at: "2026-06-01T00:00:00.000Z" }),
    "client IO with document timestamp is generated"
  );
}

function testVendorIoGeneratedUsesActiveRowCount() {
  assert(!isVendorIoGenerated(0), "zero vendor IO rows is not generated");
  assert(isVendorIoGenerated(1), "one vendor IO row is generated");
}

function testDeriveStatusDraftActiveCompleted() {
  assert(
    deriveCampaignHeaderStatus({
      hasGeneratedClientIo: false,
      hasGeneratedVendorIo: false,
      fullyInvoiced: false,
    }) === "draft",
    "no IO -> draft"
  );
  assert(
    deriveCampaignHeaderStatus({
      hasGeneratedClientIo: true,
      hasGeneratedVendorIo: false,
      fullyInvoiced: false,
    }) === "active",
    "client IO only -> active"
  );
  assert(
    deriveCampaignHeaderStatus({
      hasGeneratedClientIo: false,
      hasGeneratedVendorIo: true,
      fullyInvoiced: false,
    }) === "active",
    "vendor IO only -> active"
  );
  assert(
    deriveCampaignHeaderStatus({
      hasGeneratedClientIo: true,
      hasGeneratedVendorIo: true,
      fullyInvoiced: true,
    }) === "completed",
    "fully invoiced with IO -> completed"
  );
  assert(
    deriveCampaignHeaderStatus({
      hasGeneratedClientIo: true,
      hasGeneratedVendorIo: false,
      fullyInvoiced: false,
    }) === "active",
    "partially invoiced stays active"
  );
}

function testFullyInvoicedUsesBillingQueueSemantics() {
  assert(
    !isCampaignFullyInvoiced([]),
    "empty operational tree is not fully invoiced"
  );
  assert(
    !isCampaignFullyInvoiced([
      assignmentRow({
        billable_amount: 1000,
        invoiced_amount: 500,
        remaining_amount: 500,
        billing_status: "partially_invoiced",
        line_billing_status: "partially_invoiced",
      }),
    ]),
    "partial invoice is not fully invoiced"
  );
  assert(
    isCampaignFullyInvoiced([
      assignmentRow({
        billable_amount: 1000,
        invoiced_amount: 1000,
        remaining_amount: 0,
        billing_status: "invoiced",
        line_billing_status: "invoiced",
      }),
    ]),
    "zero remaining with invoiced amount is fully invoiced"
  );
}

function testCancelledStatusIsPreserved() {
  assert(
    !shouldAutoSyncCampaignHeaderStatus("cancelled"),
    "cancelled campaigns should not auto-sync"
  );
  assert(
    shouldAutoSyncCampaignHeaderStatus("active"),
    "active campaigns should auto-sync"
  );
}

const tests = [
  testClientIoGeneratedRequiresDocumentTimestamp,
  testVendorIoGeneratedUsesActiveRowCount,
  testDeriveStatusDraftActiveCompleted,
  testFullyInvoicedUsesBillingQueueSemantics,
  testCancelledStatusIsPreserved,
];

for (const run of tests) {
  run();
}

console.log(`sync-campaign-header-status.test.ts: ${tests.length} passed`);
