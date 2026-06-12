/**
 * Run: npx tsx lib/billing/invoice-regeneration-amounts.test.ts
 */
import {
  formatZeroBillableLineItemLabels,
  packageAssignmentLineItemPayload,
  resolveInvoiceLineBeforeVat,
} from "@/lib/billing/invoice-from-deliverables";
import { buildPostInvoiceLinePayload, type PostInvoiceLine } from "@/lib/billing/invoice-from-posts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function basePost(overrides: Partial<PostInvoiceLine> = {}): PostInvoiceLine {
  return {
    id: "post-1",
    campaign_line_id: "line-1",
    assignment_deliverable_id: "del-1",
    sequence_number: 1,
    live_date: "2026-06-01",
    billable_amount: 0,
    invoiced_amount: 0,
    remaining_amount: 0,
    revenue_before_vat: 0,
    billing_status: "ready_to_invoice",
    locked_at: null,
    invoice_line_item_id: null,
    assignment_deliverable: {
      id: "del-1",
      platform: "instagram",
      deliverable_type: "reel",
      revenue_before_vat: 5000,
      billable_amount: 5000,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      campaign_line: {
        id: "line-1",
        document_number: "TW-2026-5-A",
        name: "Creator package",
        billing_status: "moved_to_billing",
        invoice_id: null,
        campaign_header_id: "camp-1",
        revenue: 5000,
        revenue_before_vat: 5000,
        revenue_vat_percent: 0,
        revenue_vat_exempt: false,
      },
    },
    ...overrides,
  };
}

function testRegenerationUsesCorrectedCommercialAmount() {
  const amount = resolveInvoiceLineBeforeVat(
    {
      id: "del-1",
      campaign_line_id: "line-1",
      sort_order: 1,
      platform: "instagram",
      deliverable_type: "reel",
      quantity: 1,
      live_date: null,
      billable_amount: 5000,
      invoiced_amount: 3000,
      collected_amount: 0,
      disputed_amount: 0,
      remaining_amount: 3000,
      billing_status: "ready_to_invoice",
      invoice_line_item_id: null,
      locked_at: null,
      revenue_before_vat: 5000,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      label: "IG Reel",
    },
    { forRegeneration: true }
  );

  assert(amount === 5000, "regeneration should use corrected commercial amount, not stale remaining");
}

function testPostRegenerationUsesDeliverableCommercialWhenPostZeroed() {
  const payload = buildPostInvoiceLinePayload(
    "inv-1",
    "camp-1",
    basePost(),
    1,
    0,
    { forRegeneration: true }
  );

  assert(
    payload.revenue_before_vat === 5000,
    "post regeneration should fall back to deliverable commercial when post amounts were zeroed"
  );
}

function testPostCreateUsesRemainingWhenUnlocked() {
  const payload = buildPostInvoiceLinePayload(
    "inv-1",
    "camp-1",
    basePost({ remaining_amount: 2500, billable_amount: 2500 }),
    1,
    0
  );

  assert(payload.revenue_before_vat === 2500, "first create should invoice remaining billable");
}

function testPostRegenerationUsesLineCommercialWhenDeliverableZeroed() {
  const deliverable = basePost().assignment_deliverable!;
  const payload = buildPostInvoiceLinePayload(
    "inv-1",
    "camp-1",
    basePost({
      assignment_deliverable: {
        ...deliverable,
        revenue_before_vat: 0,
        billable_amount: 0,
        campaign_line: {
          ...deliverable.campaign_line!,
          revenue_before_vat: 5000,
          revenue: 5000,
        },
      },
    }),
    1,
    0,
    { forRegeneration: true }
  );

  assert(
    payload.revenue_before_vat === 5000,
    "post regeneration should fall back to assignment line commercial when deliverable and post amounts are zeroed"
  );
}

function testPostRegenerationUsesLineAgencyFeeWhenRevenueZero() {
  const deliverable = basePost().assignment_deliverable!;
  const payload = buildPostInvoiceLinePayload(
    "inv-1",
    "camp-1",
    basePost({
      assignment_deliverable: {
        ...deliverable,
        revenue_before_vat: 0,
        billable_amount: 0,
        agency_fee_amount: null,
        campaign_line: {
          ...deliverable.campaign_line!,
          revenue_before_vat: 0,
          revenue: 0,
          agency_fee_amount: 5_000,
        },
      },
    }),
    1,
    0,
    { forRegeneration: true }
  );

  assert(
    payload.revenue_before_vat === 5_000,
    "post regeneration should bill assignment agency fee when post and deliverable revenue are zero"
  );
}

function testPackageRegenerationUsesAgencyFeeWhenRevenueZero() {
  const payload = packageAssignmentLineItemPayload(
    "inv-1",
    "camp-1",
    {
      id: "line-1",
      document_number: "TW-2026-5-A",
      name: "Creator package",
      revenue: 0,
      revenue_before_vat: 0,
      usage_rights_amount: 0,
      agency_fee_amount: 5_000,
      agency_fee_percent: 0,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      remaining_amount: 5_000,
    },
    1,
    0,
    { forRegeneration: true }
  );

  assert(
    payload.revenue_before_vat === 5_000,
    "package regeneration should bill agency fee when assignment revenue is zero"
  );
}

function testDeliverableRegenerationUsesAgencyFeeWhenRevenueZero() {
  const amount = resolveInvoiceLineBeforeVat(
    {
      id: "del-1",
      campaign_line_id: "line-1",
      sort_order: 1,
      platform: "instagram",
      deliverable_type: "reel",
      quantity: 1,
      live_date: null,
      billable_amount: 0,
      invoiced_amount: 0,
      collected_amount: 0,
      disputed_amount: 0,
      remaining_amount: 0,
      billing_status: "ready_to_invoice",
      invoice_line_item_id: null,
      locked_at: null,
      revenue_before_vat: 0,
      usage_rights_amount: 0,
      agency_fee_amount: 5_000,
      agency_fee_percent: 0,
      revenue_vat_percent: 0,
      revenue_vat_exempt: false,
      label: "IG Reel",
    },
    { forRegeneration: true }
  );

  assert(
    amount === 5_000,
    "deliverable regeneration should resolve billable from agency fee when revenue is zero"
  );
}

function testZeroBillableErrorListsAssignmentDocumentNumbers() {
  const labels = formatZeroBillableLineItemLabels([
    {
      revenue_before_vat: 0,
      description: "TW-2026-5-A — Creator package · IG Reel #1",
      campaign_line: { document_number: "TW-2026-5-A" },
    },
    {
      revenue_before_vat: 5000,
      description: "TW-2026-5-B — Creator package · IG Story #1",
      campaign_line: { document_number: "TW-2026-5-B" },
    },
    {
      revenue_before_vat: 0,
      description: "TW-2026-5-C — Creator package · IG Reel #2",
      campaign_line: null,
    },
  ]);

  assert(
    labels.join(", ") === "TW-2026-5-A, TW-2026-5-C",
    "zero-billable diagnostics should list only zero rows and dedupe document numbers"
  );
}

testRegenerationUsesCorrectedCommercialAmount();
testPostRegenerationUsesDeliverableCommercialWhenPostZeroed();
testPostRegenerationUsesLineCommercialWhenDeliverableZeroed();
testPostCreateUsesRemainingWhenUnlocked();
testPostRegenerationUsesLineAgencyFeeWhenRevenueZero();
testPackageRegenerationUsesAgencyFeeWhenRevenueZero();
testDeliverableRegenerationUsesAgencyFeeWhenRevenueZero();
testZeroBillableErrorListsAssignmentDocumentNumbers();
console.log("invoice-regeneration-amounts: 8 passed");
