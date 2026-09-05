/**
 * Run: npm run test:partial-assignment-invoice
 */
import assert from "node:assert/strict";

import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";
import {
  filterCampaignQueueRows,
  filterCampaignsWithRemainingInvoiceable,
  type CampaignBillingQueueRow,
} from "@/lib/billing/campaign-billing-queue";
import { resolveInvoiceConfirmSelection } from "@/lib/billing/consolidated-invoice-queue";
import { mergeQueueRollupWithInvoiceLines } from "@/lib/billing/invoice-operational-aggregation";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import { countSubmitPayload } from "@/lib/billing/operational-selection";

function row(
  extras: Partial<CampaignBillingQueueRow> & {
    remaining_to_invoice: number;
    already_invoiced: number;
  }
): CampaignBillingQueueRow {
  const total = extras.total_campaign_amount ?? 1_000_000;
  const invoiced = extras.already_invoiced;
  const remaining = extras.remaining_to_invoice;
  return {
    campaign_header_id: extras.campaign_header_id ?? "c1",
    campaign_document_number: extras.campaign_document_number ?? "TW-2026-0007",
    campaign_name: extras.campaign_name ?? "Arab Bank",
    client_id: extras.client_id ?? "cl1",
    client_name: extras.client_name ?? "Client",
    brand_name: extras.brand_name ?? "Brand",
    legal_entity_name: extras.legal_entity_name ?? null,
    currency_code: extras.currency_code ?? "EGP",
    billing_status: (extras.billing_status ?? "draft") as CampaignLineBillingStatus,
    total_campaign_amount: total,
    achieved_revenue: extras.achieved_revenue ?? total,
    already_invoiced: invoiced,
    remaining_to_invoice: remaining,
    unachieved_revenue: extras.unachieved_revenue ?? 0,
    assignment_count: extras.assignment_count ?? 1,
    operational_row_count: extras.operational_row_count ?? 1,
  };
}

function testPartialInvoiceIsNotFullyAchieved() {
  const partial = row({
    remaining_to_invoice: 900_000,
    already_invoiced: 100_000,
    billing_status: "partially_invoiced",
  });
  const sixtyPercent = row({
    campaign_document_number: "TW-2026-0017",
    remaining_to_invoice: 400_000,
    already_invoiced: 600_000,
    billing_status: "partially_invoiced",
  });
  const unbilledDraft = row({
    remaining_to_invoice: 600_000,
    already_invoiced: 0,
    billing_status: "draft",
  });

  assert.equal(filterCampaignQueueRows([partial], "fully_achieved").length, 0);
  assert.equal(filterCampaignQueueRows([sixtyPercent], "fully_achieved").length, 0);
  assert.equal(filterCampaignQueueRows([unbilledDraft], "fully_achieved").length, 0);
  assert.equal(filterCampaignQueueRows([partial], "partially_invoiced").length, 1);
  assert.equal(filterCampaignQueueRows([sixtyPercent], "partially_invoiced").length, 1);
  assert.equal(filterCampaignQueueRows([partial], "invoiced").length, 0);
}

function testFullyInvoicedOnlyWhenRemainingIsGone() {
  const full = row({
    remaining_to_invoice: 0,
    already_invoiced: 1_000_000,
    billing_status: "invoiced",
  });
  assert.equal(filterCampaignQueueRows([full], "invoiced").length, 1);
  assert.equal(filterCampaignQueueRows([full], "fully_achieved").length, 1);
  assert.equal(filterCampaignQueueRows([full], "partially_invoiced").length, 0);
}

function testSixtyPercentInvoiceLinesKeepQueueRemaining() {
  const merged = mergeQueueRollupWithInvoiceLines({
    total_campaign_amount: 1_000_000,
    achieved_revenue: 1_000_000,
    already_invoiced: 1_000_000,
    remaining_to_invoice: 0,
    unachieved_revenue: 0,
    billing_status: "invoiced",
    invoice_line_invoiced: 600_000,
  });
  assert.equal(merged.already_invoiced, 600_000);
  assert.equal(merged.remaining_to_invoice, 400_000);
  assert.equal(merged.billing_status, "partially_invoiced");
  const kept = filterCampaignsWithRemainingInvoiceable([
    row({
      remaining_to_invoice: merged.remaining_to_invoice,
      already_invoiced: merged.already_invoiced,
      billing_status: merged.billing_status,
    }),
  ]);
  assert.equal(kept.length, 1);
}

function testQueueKeepsRemainingCampaigns() {
  const sixtyPercent = row({
    campaign_document_number: "TW-2026-0017",
    remaining_to_invoice: 400_000,
    already_invoiced: 600_000,
    billing_status: "partially_invoiced",
  });
  const full = row({
    campaign_document_number: "TW-2026-0099",
    remaining_to_invoice: 0,
    already_invoiced: 1_000_000,
    billing_status: "invoiced",
  });
  const kept = filterCampaignsWithRemainingInvoiceable([sixtyPercent, full]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.campaign_document_number, "TW-2026-0017");
}

function assignmentRow(
  extras: Partial<OperationalBillingRow> & { id: string; vendor_io_id?: string | null }
): OperationalBillingRow {
  return {
    id: extras.id,
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: extras.id,
    assignment_deliverable_id: null,
    parent_id: null,
    label: extras.label ?? "Assignment",
    document_number: extras.document_number ?? "TW-1-A",
    influencer_name: "Creator",
    platform: null,
    deliverable_type: null,
    billable_amount: extras.billable_amount ?? 1000,
    invoiced_amount: extras.invoiced_amount ?? 0,
    collected_amount: 0,
    remaining_amount: extras.remaining_amount ?? extras.billable_amount ?? 1000,
    billing_status: extras.billing_status ?? "moved_to_billing",
    line_billing_status: extras.line_billing_status ?? "moved_to_billing",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: true,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: extras.billable_amount ?? 1000,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    operational_status: "io_generated",
    vendor_io_id: extras.vendor_io_id === undefined ? "vio-1" : extras.vendor_io_id,
    vendor_io_document_number: extras.vendor_io_id === null ? null : "VIO-1",
    pricing_mode: "package",
    children: [],
  };
}

/** Create invoice with no explicit selection must use consolidated fallback, not empty payload. */
function testUndefinedSelectionUsesConsolidatedFallback() {
  const rows = [assignmentRow({ id: "line-1" })];
  const resolved = resolveInvoiceConfirmSelection(rows, undefined);
  assert.ok(resolved, "undefined selection must fall back to eligible rows");
  assert.equal(countSubmitPayload(resolved!), 1);
  assert.deepEqual(resolved!.line_ids, ["line-1"]);
}

/** Empty explicit selection must not invent invoiceable rows. */
function testEmptySelectionDoesNotInventRows() {
  const rows = [assignmentRow({ id: "line-1" })];
  const resolved = resolveInvoiceConfirmSelection(rows, {
    line_ids: [],
    deliverable_ids: [],
    post_ids: [],
  });
  assert.equal(resolved, null);
}

/** No VIO-eligible remaining rows → null (caller shows visible error, no empty confirm). */
function testNoEligibleRowsReturnsNull() {
  const rows = [assignmentRow({ id: "line-1", vendor_io_id: null })];
  const resolved = resolveInvoiceConfirmSelection(rows, undefined);
  assert.equal(resolved, null);
}

function run() {
  testPartialInvoiceIsNotFullyAchieved();
  testFullyInvoicedOnlyWhenRemainingIsGone();
  testQueueKeepsRemainingCampaigns();
  testSixtyPercentInvoiceLinesKeepQueueRemaining();
  testUndefinedSelectionUsesConsolidatedFallback();
  testEmptySelectionDoesNotInventRows();
  testNoEligibleRowsReturnsNull();
  console.log("campaign-billing-queue.test.ts: ok");
}

run();
