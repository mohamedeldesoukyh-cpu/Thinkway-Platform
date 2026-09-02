/**
 * Run: npm run test:partial-assignment-invoice
 */
import assert from "node:assert/strict";

import {
  CAMPAIGN_INVOICE_DRAFT_ID,
  buildInvoiceDraftSubmit,
  cascadeInvoiceDraftPercent,
  cascadeInvoiceDraftToBeInvoiced,
  computeCampaignInvoiceDraft,
  computeInvoiceDraftLine,
  invoiceDraftKey,
  type InvoiceDraftPercents,
} from "@/lib/billing/operational-invoice-draft";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

const A1 = "11111111-1111-1111-1111-111111111111";
const A2 = "22222222-2222-2222-2222-222222222222";
const A3 = "33333333-3333-3333-3333-333333333333";
const A4 = "44444444-4444-4444-4444-444444444444";

function assignment(
  id: string,
  remaining: number,
  extras?: Partial<OperationalBillingRow>
): OperationalBillingRow {
  return {
    id,
    kind: "assignment",
    campaign_header_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    campaign_line_id: id,
    assignment_deliverable_id: null,
    parent_id: null,
    label: id,
    document_number: null,
    influencer_name: null,
    platform: null,
    deliverable_type: null,
    billable_amount: remaining,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: remaining,
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
    revenue_before_vat: remaining,
    revenue_vat_percent: extras?.revenue_vat_percent ?? 0,
    revenue_vat_exempt: false,
    children: extras?.children ?? [],
    ...extras,
  };
}

function allLines(rows: OperationalBillingRow[]) {
  return {
    line_ids: rows.map((row) => row.id),
    deliverable_ids: [] as string[],
    post_ids: [] as string[],
  };
}

function testDefaultIsOneHundredPercent() {
  const rows = [assignment(A1, 10_000), assignment(A2, 10_000)];
  const campaign = computeCampaignInvoiceDraft(rows, {});
  assert.equal(campaign.percent, 100);
  assert.equal(campaign.toBeInvoiced, 20_000);
  assert.equal(campaign.remaining, 0);
}

function testMainLinePercentCascadesToAssignments() {
  const rows = [assignment(A1, 10_000), assignment(A2, 10_000)];
  const percents = cascadeInvoiceDraftPercent(rows, CAMPAIGN_INVOICE_DRAFT_ID, 50, {});
  assert.equal(computeInvoiceDraftLine(rows[0]!, percents).percent, 50);
  assert.equal(computeInvoiceDraftLine(rows[1]!, percents).toBeInvoiced, 5_000);
  const campaign = computeCampaignInvoiceDraft(rows, percents);
  assert.equal(campaign.percent, 50);
  assert.equal(campaign.toBeInvoiced, 10_000);
  assert.equal(campaign.remaining, 10_000);
}

function testMixedAssignmentPercentsRollUpToMainLine() {
  const rows = [
    assignment(A1, 10_000),
    assignment(A2, 10_000),
    assignment(A3, 10_000),
    assignment(A4, 10_000),
  ];
  let percents: InvoiceDraftPercents = {};
  percents = cascadeInvoiceDraftPercent(rows, A1, 100, percents);
  percents = cascadeInvoiceDraftPercent(rows, A2, 100, percents);
  percents = cascadeInvoiceDraftPercent(rows, A3, 50, percents);
  percents = cascadeInvoiceDraftPercent(rows, A4, 50, percents);

  const campaign = computeCampaignInvoiceDraft(rows, percents);
  assert.equal(campaign.amount, 40_000);
  assert.equal(campaign.percent, 75);
  assert.equal(campaign.toBeInvoiced, 30_000);
  assert.equal(campaign.remaining, 10_000);
}

function testToBeInvoicedOnMainLineCascadesPercent() {
  const rows = [assignment(A1, 10_000), assignment(A2, 10_000)];
  const percents = cascadeInvoiceDraftToBeInvoiced(rows, CAMPAIGN_INVOICE_DRAFT_ID, 10_000, {});
  const campaign = computeCampaignInvoiceDraft(rows, percents);
  assert.equal(campaign.percent, 50);
  assert.equal(computeInvoiceDraftLine(rows[0]!, percents).toBeInvoiced, 5_000);
}

function testAssignmentPercentCascadesToChildren() {
  const postId = "55555555-5555-5555-5555-555555555555";
  const post = assignment(postId, 10_000, { kind: "post", parent_id: A1 });
  const line = assignment(A1, 10_000, { children: [post] });
  const percents = cascadeInvoiceDraftPercent([line], A1, 50, {});
  assert.equal(computeInvoiceDraftLine(post, percents).percent, 50);
  assert.equal(computeInvoiceDraftLine(line, percents).toBeInvoiced, 5_000);
}

function testVatOnToBeInvoicedSlice() {
  const row = assignment(A1, 10_000, { revenue_vat_percent: 14 });
  const percents = cascadeInvoiceDraftPercent([row], A1, 50, {});
  const draft = computeInvoiceDraftLine(row, percents);
  assert.equal(draft.toBeInvoiced, 5_000);
  assert.equal(draft.vatAmount, 700);
  assert.equal(draft.totalInvoice, 5_700);
}

function testSubmitOmitsZeroPercentLeaves() {
  const rows = [assignment(A1, 10_000), assignment(A2, 10_000)];
  const percents = cascadeInvoiceDraftPercent(rows, A2, 0, {});
  const submit = buildInvoiceDraftSubmit(rows, percents, allLines(rows));
  assert.equal(submit.payload.line_ids.length, 1);
  assert.equal(submit.payload.line_ids[0], A1);
  assert.equal(submit.allocations[invoiceDraftKey(rows[0]!)], 10_000);
  assert.equal(submit.allocations[invoiceDraftKey(rows[1]!)], undefined);
}

function run() {
  testDefaultIsOneHundredPercent();
  testMainLinePercentCascadesToAssignments();
  testMixedAssignmentPercentsRollUpToMainLine();
  testToBeInvoicedOnMainLineCascadesPercent();
  testAssignmentPercentCascadesToChildren();
  testVatOnToBeInvoicedSlice();
  testSubmitOmitsZeroPercentLeaves();
  console.log("operational-invoice-draft.test.ts: ok");
}

run();
