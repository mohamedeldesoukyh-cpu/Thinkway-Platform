/**
 * Billing lifecycle scenario tests — run: npx tsx lib/billing/invoice-lifecycle-scenarios.test.ts
 */
import {
  buildInvoiceValidationContext,
  invoicedRowAllowed,
  isInvoicedOperationalRow,
} from "@/lib/billing/invoice-validation-context";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";
import {
  ensureOperationalBillingTreeShape,
  isOperationalRowInvoiceEligible,
  isOperationalRowUiSelectable,
  type OperationalBillingRow,
} from "@/lib/billing/operational-billing-rows";
import {
  buildOperationalBillingContext,
  normalizeOperationalBillingTree,
} from "@/lib/billing/operational-financial-sync";
import {
  enrichRegenerationEligibilityInput,
  hasInvoiceLinkage,
  resolveInvoiceActionLabel,
} from "@/lib/billing/regeneration-eligibility";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function baseRow(
  overrides: Partial<OperationalBillingRow> = {}
): OperationalBillingRow {
  return {
    id: "line-1",
    kind: "deliverable_group",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-1",
    assignment_deliverable_id: "del-1",
    parent_id: "line-1",
    label: "IG Reel",
    document_number: null,
    influencer_name: "Creator",
    platform: "instagram",
    deliverable_type: "reel",
    billable_amount: 1000,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: 1000,
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
    revenue_before_vat: 1000,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    line_pricing_mode: "per_deliverable",
    operational_status: "io_generated",
    vendor_io_id: "vio-1",
    children: [],
    ...overrides,
  };
}

function testFirstGenerationEligibility() {
  const row = baseRow();
  assert(isOperationalRowInvoiceEligible(row), "fresh row should be invoice eligible");
  assert(isOperationalRowUiSelectable(row), "fresh row should be UI selectable");
}

function testAppendAllowsSameInvoiceRows() {
  const ctx = buildInvoiceValidationContext({
    mode: "append",
    targetInvoiceId: "inv-1",
  });
  const row = {
    locked_at: "2026-01-01",
    invoice_line_item_id: "ili-1",
    linked_invoice_id: "inv-1",
  };
  assert(isInvoicedOperationalRow(row), "append row is invoiced");
  assert(invoicedRowAllowed(row, ctx), "same-invoice rows allowed on append");
}

function testAppendBlocksDifferentInvoice() {
  const ctx = buildInvoiceValidationContext({
    mode: "append",
    targetInvoiceId: "inv-1",
  });
  const row = {
    locked_at: "2026-01-01",
    invoice_line_item_id: "ili-1",
    linked_invoice_id: "inv-2",
  };
  assert(!invoicedRowAllowed(row, ctx), "different-invoice rows blocked on append");
}

function testPartialInvoiceRemainingRevenue() {
  const row = baseRow({
    invoiced_amount: 400,
    remaining_amount: 600,
    billing_status: "partially_invoiced",
    line_billing_status: "partially_invoiced",
  });
  assert(isOperationalRowInvoiceEligible(row), "partial row with remaining revenue eligible");
}

function testRegenerateSameRowsPendingRegeneration() {
  const row = baseRow({
    invoice_line_item_id: "ili-1",
    linked_invoice_id: "inv-1",
    invoice_regeneration_status: "pending_regeneration",
    invoiced_amount: 1000,
    remaining_amount: 0,
    is_locked: true,
    locked_at: null,
    billing_status: "ready_to_invoice",
    line_billing_status: "moved_to_billing",
  });
  assert(
    isOperationalRowInvoiceEligible(row),
    "pending_regeneration linked rows stay eligible for regenerate"
  );
  assert(
    isOperationalRowUiSelectable(row),
    "pending_regeneration rows stay selectable for regenerate"
  );
}

function testActiveInvoiceLockBlocksNewGeneration() {
  const row = baseRow({
    invoice_line_item_id: "ili-1",
    linked_invoice_id: "inv-1",
    invoice_regeneration_status: "active",
    invoiced_amount: 1000,
    remaining_amount: 0,
    is_locked: true,
    locked_at: "2026-01-01",
    billing_status: "invoiced",
    line_billing_status: "invoiced",
  });
  assert(!isOperationalRowInvoiceEligible(row), "active invoiced row blocked from new generation");
}

function testUngenerateResolvesToActiveFinancialTotals() {
  assert(
    isActiveInvoiceForFinancialTotals({
      status: "draft",
      regeneration_status: "active",
    }),
    "active regeneration status counts in financial totals"
  );
  assert(
    !isActiveInvoiceForFinancialTotals({
      status: "draft",
      regeneration_status: "regenerated",
    }),
    "legacy regenerated status excluded from totals"
  );
}

function testRegenerateActionLabel() {
  const label = resolveInvoiceActionLabel({
    invoiceLineIds: ["line-1"],
    getRow: () => ({
      invoice_id: "inv-1",
      invoiced_amount: 1000,
      remaining_amount: 0,
      billable_amount: 1000,
      billing_status: "invoiced",
      regeneration_status: "pending_regeneration",
      vendor_io_id: "vio-1",
      vendor_io_document_number: "VIO-1",
    }),
  });
  assert(label === "regenerate", "pending_regeneration context yields regenerate label");
}

function testRegenerateLabelAfterUngenerateUnlock() {
  const enriched = enrichRegenerationEligibilityInput(
    {
      billing_status: "moved_to_billing",
      operational_status: "io_generated",
      vendor_io_id: "vio-1",
      vendor_io_document_number: "VIO-1",
      invoice_id: null,
      invoiced_amount: 0,
      remaining_amount: 2000,
      billable_amount: 2000,
      finance_override_until: new Date(Date.now() + 86400000).toISOString(),
    },
    {
      pending_regeneration_invoice_id: "inv-1",
      regeneration_status: "pending_regeneration",
      invoice_status: "draft",
    }
  );

  const label = resolveInvoiceActionLabel({
    invoiceLineIds: ["line-1"],
    getRow: () => enriched,
  });
  assert(label === "regenerate", "ungenerated unlocked line yields regenerate label");
}

function testDuplicatePreventionValidationContext() {
  const newCtx = buildInvoiceValidationContext({ mode: "new" });
  const invoiced = {
    invoice_line_item_id: "ili-1",
    locked_at: "2026-01-01",
    linked_invoice_id: "inv-1",
  };
  assert(!invoicedRowAllowed(invoiced, newCtx), "new invoice blocks already invoiced rows");
}

function testQueueLinkageTruth() {
  assert(
    hasInvoiceLinkage({
      invoice_id: "inv-1",
      invoiced_amount: 0,
      billing_status: "moved_to_billing",
    }),
    "invoice_id linkage detected for queue sync"
  );
}

function testStaleInvoicePointerWithRemainingRevenue() {
  const row = baseRow({
    invoice_line_item_id: "ili-stale",
    locked_at: "2026-01-01",
    is_locked: true,
    billable_amount: 13750,
    invoiced_amount: 0,
    remaining_amount: 13750,
    billing_status: "ready_to_invoice",
  });
  assert(
    isOperationalRowInvoiceEligible(row),
    "stale invoice pointer with remaining revenue stays invoice eligible"
  );
  assert(
    isOperationalRowUiSelectable(row),
    "stale invoice pointer with remaining revenue stays UI selectable"
  );
}

function testOperationalTreeShapeBoundary() {
  const row = baseRow({
    children: undefined as unknown as OperationalBillingRow[],
  });
  const shaped = ensureOperationalBillingTreeShape([row]);
  assert(Array.isArray(shaped[0]?.children), "boundary coerces missing children to []");
  const ctx = buildOperationalBillingContext([], []);
  normalizeOperationalBillingTree(shaped, ctx);
}

const tests = [
  testFirstGenerationEligibility,
  testAppendAllowsSameInvoiceRows,
  testAppendBlocksDifferentInvoice,
  testPartialInvoiceRemainingRevenue,
  testStaleInvoicePointerWithRemainingRevenue,
  testRegenerateSameRowsPendingRegeneration,
  testActiveInvoiceLockBlocksNewGeneration,
  testUngenerateResolvesToActiveFinancialTotals,
  testRegenerateActionLabel,
  testRegenerateLabelAfterUngenerateUnlock,
  testDuplicatePreventionValidationContext,
  testQueueLinkageTruth,
  testOperationalTreeShapeBoundary,
];

for (const run of tests) {
  run();
}

console.log(`invoice-lifecycle-scenarios: ${tests.length} passed`);
