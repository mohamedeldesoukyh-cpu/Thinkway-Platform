/**
 * Run: npx tsx lib/campaigns/sync-campaign-header-status.test.ts
 */
import {
  deriveCampaignHeaderStatus,
  isCampaignFullyInvoicedFromLines,
  isClientIoGenerated,
  isVendorIoGenerated,
  shouldAutoSyncCampaignHeaderStatus,
} from "@/lib/campaigns/sync-campaign-header-status";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testClientIoGeneratedSignals() {
  assert(!isClientIoGenerated(null), "missing client IO is not generated");
  assert(!isClientIoGenerated({ status: "draft" }), "draft client IO is not generated");
  assert(
    isClientIoGenerated({ document_generated_at: "2026-06-01T00:00:00.000Z" }),
    "client IO with document timestamp is generated"
  );
  assert(isClientIoGenerated({ status: "sent" }), "sent client IO is generated");
  assert(
    isClientIoGenerated({ sent_at: "2026-06-01T00:00:00.000Z" }),
    "client IO with sent_at is generated"
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

function testFullyInvoicedFromLines() {
  assert(!isCampaignFullyInvoicedFromLines([]), "empty lines is not fully invoiced");
  assert(
    !isCampaignFullyInvoicedFromLines([
      {
        billing_status: "partially_invoiced",
        invoice_id: null,
        revenue: 1000,
      },
    ]),
    "partial line billing is not fully invoiced"
  );
  assert(
    isCampaignFullyInvoicedFromLines([
      {
        billing_status: "invoiced",
        invoice_id: "inv-1",
        revenue: 1000,
      },
    ]),
    "all terminal lines with revenue is fully invoiced"
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
  testClientIoGeneratedSignals,
  testVendorIoGeneratedUsesActiveRowCount,
  testDeriveStatusDraftActiveCompleted,
  testFullyInvoicedFromLines,
  testCancelledStatusIsPreserved,
];

for (const run of tests) {
  run();
}

console.log(`sync-campaign-header-status.test.ts: ${tests.length} passed`);
