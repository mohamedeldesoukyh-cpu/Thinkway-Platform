/**
 * Run: npx tsx lib/billing/regeneration-eligibility.test.ts
 */
import {
  enrichRegenerationEligibilityInput,
  hasLineEverBeenInvoiced,
  isAssignmentInvoiceSelectable,
  partitionInvoiceLineIdsByAction,
  resolveInvoiceActionForSelection,
  resolveInvoiceActionLabel,
} from "@/lib/billing/regeneration-eligibility";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testFreshLineShowsGenerate() {
  const label = resolveInvoiceActionLabel({
    invoiceLineIds: ["line-3"],
    getRow: () => ({
      billing_status: "moved_to_billing",
      operational_status: "io_generated",
      vendor_io_id: "vio-3",
      invoice_id: null,
      invoiced_amount: 0,
      billable_amount: 4000,
      remaining_amount: 4000,
    }),
  });
  assert(label === "generate", "never-invoiced line should offer generate");
}

function testInvoicedLineShowsRegenerate() {
  const label = resolveInvoiceActionLabel({
    invoiceLineIds: ["line-1"],
    getRow: () => ({
      billing_status: "invoiced",
      operational_status: "locked",
      vendor_io_id: "vio-1",
      invoice_id: "inv-1",
      invoiced_amount: 10000,
      billable_amount: 10000,
      remaining_amount: 0,
      regeneration_status: "pending_regeneration",
      invoice_status: "draft",
    }),
  });
  assert(label === "regenerate", "pending regeneration invoiced line should offer regenerate");
}

function testFullyInvoicedLockedLineNotSelectable() {
  assert(
    !isAssignmentInvoiceSelectable({
      billing_status: "invoiced",
      operational_status: "locked",
      vendor_io_id: "vio-1",
      active_vendor_io_id: "vio-1",
      vendor_io_document_number: "VIO-1",
      invoice_id: "inv-1",
      billable_amount: 3500,
      invoiced_amount: 3500,
      remaining_amount: 0,
    }),
    "fully invoiced locked line should not be invoice-selectable"
  );
}

function testPendingRegenDoesNotBleedOntoFreshLine() {
  const enriched = enrichRegenerationEligibilityInput(
    {
      billing_status: "moved_to_billing",
      operational_status: "io_generated",
      vendor_io_id: "vio-3",
      invoice_id: null,
      invoiced_amount: 0,
    },
    {
      pending_regeneration_invoice_id: "inv-pending",
      regeneration_status: "pending_regeneration",
      invoice_status: "draft",
    }
  );
  assert(
    enriched.invoice_id == null && enriched.regeneration_status !== "pending_regeneration",
    "pending regeneration context must not attach to fresh lines"
  );
}

function testMixedSelectionUsesGenerate() {
  const futureOverride = new Date(Date.now() + 86400000).toISOString();
  const resolved = resolveInvoiceActionForSelection({
    lineIds: ["line-1", "line-3"],
    getRow: (lineId) => {
      if (lineId === "line-1") {
        return enrichRegenerationEligibilityInput(
          {
            billing_status: "moved_to_billing",
            operational_status: "io_generated",
            vendor_io_id: "vio-1",
            invoice_id: null,
            invoiced_amount: 0,
            billable_amount: 10000,
            remaining_amount: 10000,
            finance_override_until: futureOverride,
          },
          {
            pending_regeneration_invoice_id: "inv-1",
            regeneration_status: "pending_regeneration",
            invoice_status: "draft",
          }
        );
      }
      return {
        billing_status: "moved_to_billing",
        operational_status: "io_generated",
        vendor_io_id: "vio-3",
        invoice_id: null,
        invoiced_amount: 0,
        billable_amount: 4000,
        remaining_amount: 4000,
      };
    },
  });
  assert(resolved.action === "generate", "mixed selection should offer generate");
  assert(
    resolved.regenerateLineIds.length === 1 && resolved.generateLineIds.length === 1,
    "mixed selection partitions regenerate vs generate lines"
  );
  assert(
    resolved.actionLineIds.join(",") === "line-3",
    "generate action scopes only never-invoiced lines"
  );
}

function testAllUngeneratedLinesUseRegenerate() {
  const futureOverride = new Date(Date.now() + 86400000).toISOString();
  const lineIds = ["line-1", "line-2", "line-4", "line-5"];
  const { regenerateLineIds, generateLineIds } = partitionInvoiceLineIdsByAction(
    lineIds,
    (lineId) =>
      enrichRegenerationEligibilityInput(
        {
          billing_status: "moved_to_billing",
          operational_status: "io_generated",
          vendor_io_id: `vio-${lineId}`,
          invoice_id: null,
          invoiced_amount: 0,
          billable_amount: 5000,
          remaining_amount: 5000,
          finance_override_until: futureOverride,
        },
        {
          pending_regeneration_invoice_id: "inv-1",
          regeneration_status: "pending_regeneration",
          invoice_status: "draft",
        }
      )
  );
  assert(regenerateLineIds.length === lineIds.length, "all ungenerated lines regenerate");
  assert(generateLineIds.length === 0, "no generate lines when all were previously invoiced");
}

function testHasLineEverBeenInvoiced() {
  assert(
    !hasLineEverBeenInvoiced({
      billing_status: "moved_to_billing",
      invoice_id: null,
      invoiced_amount: 0,
    }),
    "moved to billing alone is not proof of invoicing"
  );
  assert(
    hasLineEverBeenInvoiced({
      billing_status: "invoiced",
      invoice_id: "inv-1",
      invoiced_amount: 1000,
    }),
    "invoice link is proof"
  );
}

testFreshLineShowsGenerate();
testInvoicedLineShowsRegenerate();
testFullyInvoicedLockedLineNotSelectable();
testPendingRegenDoesNotBleedOntoFreshLine();
testMixedSelectionUsesGenerate();
testAllUngeneratedLinesUseRegenerate();
testHasLineEverBeenInvoiced();
console.log("regeneration-eligibility.test.ts: ok");
