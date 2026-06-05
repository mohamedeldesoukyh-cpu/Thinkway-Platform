/**
 * Vendor IO revise lifecycle checks — run: npx tsx lib/billing/vendor-io-revision-scenarios.test.ts
 */
import {
  getCampaignLineStatusViolations,
  isCampaignLineStatusValid,
  repairCampaignLineStatusPatch,
} from "@/lib/campaigns/campaign-line-status-invariants";
import { deriveLineBillingStatusFromDeliverables } from "@/lib/billing/deliverable-billing";
import type { DeliverableBillingRow } from "@/lib/billing/deliverable-billing";
import { vendorIoRevisionDocumentNumber } from "@/lib/io/vendor-io-revision";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function makeDeliverable(
  overrides: Partial<DeliverableBillingRow> = {}
): DeliverableBillingRow {
  return {
    id: "del-1",
    campaign_line_id: "line-1",
    sort_order: 0,
    platform: "instagram",
    deliverable_type: "reel",
    quantity: 1,
    live_date: null,
    billable_amount: 1000,
    invoiced_amount: 0,
    collected_amount: 0,
    disputed_amount: 0,
    remaining_amount: 1000,
    billing_status: "ready_to_invoice",
    invoice_line_item_id: null,
    locked_at: null,
    revenue_before_vat: 1000,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    label: "IG Reel #1",
    ...overrides,
  };
}

function testScenario1PostReviseLineState() {
  const violations = getCampaignLineStatusViolations({
    operational_status: "reopened",
    billing_status: "invoiced",
    invoice_id: null,
    vendor_io_id: "vio-new",
  });
  assert(violations.length > 0, "reopened+invoiced without invoice should violate");

  const repaired = repairCampaignLineStatusPatch(
    {
      operational_status: "reopened",
      billing_status: "invoiced",
      invoice_id: null,
      vendor_io_id: "vio-new",
    },
    { operational_status: "io_generated", billing_status: "moved_to_billing" }
  );

  const after = {
    operational_status: String(repaired.operational_status ?? "io_generated"),
    billing_status: String(repaired.billing_status ?? "moved_to_billing"),
    invoice_id: null,
    vendor_io_id: "vio-new",
  };
  assert(isCampaignLineStatusValid(after), "repaired post-revise snapshot must be valid");
}

function testScenario2BillingDerivesMovedToBillingAfterUnlock() {
  const deliverables = [
    makeDeliverable({
      billing_status: "ready_to_invoice",
      invoiced_amount: 0,
      remaining_amount: 1000,
    }),
  ];
  const next = deriveLineBillingStatusFromDeliverables(deliverables, "invoiced");
  assert(
    next === "moved_to_billing",
    `unlocked deliverables should drop stale header invoiced (got ${next})`
  );
}

function testScenario3InvoicedRequiresInvoiceId() {
  const violations = getCampaignLineStatusViolations({
    operational_status: "invoiced",
    billing_status: "invoiced",
    invoice_id: null,
  });
  assert(violations.some((v) => v.includes("invoice_id")), "invoiced billing needs invoice_id");

  const valid = isCampaignLineStatusValid({
    operational_status: "invoiced",
    billing_status: "invoiced",
    invoice_id: "inv-1",
  });
  assert(valid, "invoiced with invoice_id is valid");
}

function testScenario4ReopenedCannotLinkInvoice() {
  const violations = getCampaignLineStatusViolations({
    operational_status: "reopened",
    billing_status: "moved_to_billing",
    invoice_id: "inv-stale",
  });
  assert(violations.length > 0, "reopened with invoice_id should violate");

  const repaired = repairCampaignLineStatusPatch({
    operational_status: "reopened",
    billing_status: "moved_to_billing",
    invoice_id: "inv-stale",
    vendor_io_id: "vio-2",
  });
  assert(repaired.invoice_id === null, "repair must clear invoice_id");
  assert(repaired.operational_status === "io_generated", "repair must promote to io_generated");
}

function testScenario5RevisionNumbering() {
  assert(
    vendorIoRevisionDocumentNumber("VIO-2026-0001", 1) === "VIO-2026-0001/1",
    "revision suffix /1"
  );
  assert(
    vendorIoRevisionDocumentNumber("VIO-2026-0001/1", 2) === "VIO-2026-0001/2",
    "revision suffix /2 from prior revision doc"
  );
}

function run() {
  testScenario1PostReviseLineState();
  testScenario2BillingDerivesMovedToBillingAfterUnlock();
  testScenario3InvoicedRequiresInvoiceId();
  testScenario4ReopenedCannotLinkInvoice();
  testScenario5RevisionNumbering();
  console.log("[vendor-io-revision-scenarios] all checks passed");
}

run();
