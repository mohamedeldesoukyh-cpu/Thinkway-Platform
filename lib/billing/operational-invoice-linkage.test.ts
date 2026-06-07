/**
 * Run: npx tsx lib/billing/operational-invoice-linkage.test.ts
 */
import { applyOperationalInvoiceLinkage } from "@/lib/billing/operational-invoice-linkage";
import { buildConsolidatedInvoiceQueueRows } from "@/lib/billing/consolidated-invoice-queue";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testActiveInvoiceLineItemsApplyWhenDeliverablesUnlocked() {
  const assignment: OperationalBillingRow = {
    id: "line-1",
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-1",
    assignment_deliverable_id: null,
    parent_id: null,
    label: "Assignment",
    document_number: "TW-1-A",
    influencer_name: "Creator",
    platform: null,
    deliverable_type: null,
    billable_amount: 2000,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: 2000,
    billing_status: "moved_to_billing",
    line_billing_status: "moved_to_billing",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: true,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: 2000,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    operational_status: "io_generated",
    vendor_io_id: "vio-1",
    vendor_io_document_number: "VIO-1",
    pricing_mode: "package",
    children: [
      {
        id: "del-1",
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
        billable_amount: 2000,
        invoiced_amount: 0,
        collected_amount: 0,
        remaining_amount: 2000,
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
        revenue_before_vat: 2000,
        revenue_vat_percent: 0,
        revenue_vat_exempt: false,
        line_pricing_mode: "package",
        children: [],
      },
    ],
  };

  const linked = applyOperationalInvoiceLinkage(
    [assignment],
    [
      {
        invoice_id: "inv-1",
        deliverable_id: "del-1",
        post_id: null,
        line_id: "line-1",
        revenue_before_vat: 2000,
        document_number: "INV-1",
        invoice_status: "draft",
        regeneration_status: "active",
      },
    ]
  );

  assert(linked[0]?.remaining_amount === 0, "active invoice line items zero remaining");
  assert(linked[0]?.invoiced_amount === 2000, "active invoice line items set invoiced");
  assert(
    linked[0]?.children[0]?.remaining_amount === 0,
    "child deliverable remaining cleared"
  );
}

function testPendingRegenerationKeepsRemainingWhenUnlocked() {
  const assignment: OperationalBillingRow = {
    id: "line-1",
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-1",
    assignment_deliverable_id: null,
    parent_id: null,
    label: "Assignment",
    document_number: "TW-1-A",
    influencer_name: "Creator",
    platform: null,
    deliverable_type: null,
    billable_amount: 2000,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: 2000,
    billing_status: "moved_to_billing",
    line_billing_status: "moved_to_billing",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: true,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: 2000,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    operational_status: "io_generated",
    vendor_io_id: "vio-1",
    vendor_io_document_number: "VIO-1",
    pricing_mode: "package",
    children: [
      {
        id: "del-1",
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
        billable_amount: 2000,
        invoiced_amount: 0,
        collected_amount: 0,
        remaining_amount: 2000,
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
        revenue_before_vat: 2000,
        revenue_vat_percent: 0,
        revenue_vat_exempt: false,
        line_pricing_mode: "package",
        children: [],
      },
    ],
  };

  const linked = applyOperationalInvoiceLinkage(
    [assignment],
    [
      {
        invoice_id: "inv-1",
        deliverable_id: null,
        post_id: null,
        line_id: "line-1",
        revenue_before_vat: 0,
        document_number: "INV-1",
        invoice_status: "draft",
        regeneration_status: "pending_regeneration",
      },
    ]
  );

  assert(linked[0]?.remaining_amount === 2000, "pending regeneration keeps remaining");
}

function testDeliverableLineItemsApplyWhenPostChildrenExist() {
  const assignment: OperationalBillingRow = {
    id: "line-1",
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-1",
    assignment_deliverable_id: null,
    parent_id: null,
    label: "Assignment",
    document_number: "TW-1-A",
    influencer_name: "Creator",
    platform: null,
    deliverable_type: null,
    billable_amount: 3000,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: 3000,
    billing_status: "moved_to_billing",
    line_billing_status: "moved_to_billing",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: true,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: 3000,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    operational_status: "io_generated",
    vendor_io_id: "vio-1",
    vendor_io_document_number: "VIO-1",
    pricing_mode: "per_deliverable",
    children: [
      {
        id: "del-1",
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
        billable_amount: 3000,
        invoiced_amount: 0,
        collected_amount: 0,
        remaining_amount: 3000,
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
        revenue_before_vat: 3000,
        revenue_vat_percent: 0,
        revenue_vat_exempt: false,
        line_pricing_mode: "per_deliverable",
        children: [
          {
            id: "post-1",
            kind: "post",
            campaign_header_id: "camp-1",
            campaign_line_id: "line-1",
            assignment_deliverable_id: "del-1",
            parent_id: "del-1",
            label: "Post 1",
            document_number: null,
            influencer_name: "Creator",
            platform: "instagram",
            deliverable_type: "reel",
            billable_amount: 3000,
            invoiced_amount: 0,
            collected_amount: 0,
            remaining_amount: 3000,
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
            revenue_before_vat: 3000,
            revenue_vat_percent: 0,
            revenue_vat_exempt: false,
            line_pricing_mode: "per_deliverable",
            children: [],
          },
        ],
      },
    ],
  };

  const linked = applyOperationalInvoiceLinkage(
    [assignment],
    [
      {
        invoice_id: "inv-1",
        deliverable_id: "del-1",
        post_id: null,
        line_id: "line-1",
        revenue_before_vat: 3000,
        document_number: "INV-1",
        invoice_status: "draft",
        regeneration_status: "active",
      },
    ]
  );

  assert(linked[0]?.remaining_amount === 0, "assignment remaining cleared via deliverable line item");
  assert(
    linked[0]?.children[0]?.remaining_amount === 0,
    "deliverable group remaining cleared when posts exist"
  );
  assert(
    linked[0]?.children[0]?.children[0]?.remaining_amount === 0,
    "post leaves cleared when deliverable is fully invoiced"
  );

  const queue = buildConsolidatedInvoiceQueueRows({
    campaign_header_id: "camp-1",
    campaign_document_number: "TW-1",
    campaign_name: "Campaign",
    client_name: "Client",
    brand_name: null,
    currency_code: "USD",
    operational_rows: linked,
  });
  assert(queue.length === 0, "billing queue hidden after active invoice linkage");
}

function testInvoicedAssignmentStaleRemainingStaysInQueueUntilCovered() {
  const assignment: OperationalBillingRow = {
    id: "line-b",
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-b",
    assignment_deliverable_id: null,
    parent_id: null,
    label: "Assignment B",
    document_number: "TW-1-B",
    influencer_name: "Creator",
    platform: null,
    deliverable_type: null,
    billable_amount: 3500,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: 3500,
    billing_status: "invoiced",
    line_billing_status: "invoiced",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: false,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: 3500,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    operational_status: "locked",
    vendor_io_id: "vio-b",
    vendor_io_document_number: "VIO-B",
    pricing_mode: "package",
    children: [],
  };

  const queue = buildConsolidatedInvoiceQueueRows({
    campaign_header_id: "camp-1",
    campaign_document_number: "TW-1",
    campaign_name: "Campaign",
    client_name: "Client",
    brand_name: null,
    currency_code: "USD",
    operational_rows: [assignment],
  });

  assert(queue.length === 1, "phantom invoiced assignment stays in queue until invoice coverage exists");
  assert(
    queue[0]?.revenue_before_vat === 3500,
    "queue shows stale remaining until line items exist"
  );
}

function testIssuedInvoiceLineItemLinkageWithoutLineInvoiceId() {
  const assignment: OperationalBillingRow = {
    id: "line-b",
    kind: "assignment",
    campaign_header_id: "camp-1",
    campaign_line_id: "line-b",
    assignment_deliverable_id: null,
    parent_id: null,
    label: "Assignment B",
    document_number: "TW-1-B",
    influencer_name: "Creator",
    platform: null,
    deliverable_type: null,
    billable_amount: 3500,
    invoiced_amount: 0,
    collected_amount: 0,
    remaining_amount: 3500,
    billing_status: "invoiced",
    line_billing_status: "invoiced",
    invoice_id: null,
    invoice_document_number: null,
    invoice_line_item_id: null,
    locked_at: null,
    is_locked: false,
    is_invoice_eligible: false,
    is_achieved: true,
    is_legacy_synthetic: false,
    revenue_before_vat: 3500,
    revenue_vat_percent: 0,
    revenue_vat_exempt: false,
    operational_status: "locked",
    vendor_io_id: "vio-b",
    vendor_io_document_number: "VIO-B",
    pricing_mode: "package",
    children: [
      {
        id: "del-b",
        kind: "deliverable_group",
        campaign_header_id: "camp-1",
        campaign_line_id: "line-b",
        assignment_deliverable_id: "del-b",
        parent_id: "line-b",
        label: "IG Reel",
        document_number: null,
        influencer_name: "Creator",
        platform: "instagram",
        deliverable_type: "reel",
        billable_amount: 3500,
        invoiced_amount: 0,
        collected_amount: 0,
        remaining_amount: 3500,
        billing_status: "invoiced",
        line_billing_status: "invoiced",
        invoice_id: null,
        invoice_document_number: null,
        invoice_line_item_id: null,
        locked_at: null,
        is_locked: false,
        is_invoice_eligible: false,
        is_achieved: true,
        is_legacy_synthetic: false,
        revenue_before_vat: 3500,
        revenue_vat_percent: 0,
        revenue_vat_exempt: false,
        line_pricing_mode: "package",
        children: [],
      },
    ],
  };

  const linked = applyOperationalInvoiceLinkage(
    [assignment],
    [
      {
        invoice_id: "inv-1",
        deliverable_id: null,
        post_id: null,
        line_id: "line-b",
        revenue_before_vat: 3500,
        document_number: "INV-1",
        invoice_status: "draft",
        regeneration_status: null,
      },
    ]
  );

  assert(linked[0]?.remaining_amount === 0, "issued line item clears stale remaining without line invoice_id");
  assert(linked[0]?.invoiced_amount === 3500, "issued line item sets invoiced amount");
}

const tests = [
  testActiveInvoiceLineItemsApplyWhenDeliverablesUnlocked,
  testPendingRegenerationKeepsRemainingWhenUnlocked,
  testDeliverableLineItemsApplyWhenPostChildrenExist,
  testInvoicedAssignmentStaleRemainingStaysInQueueUntilCovered,
  testIssuedInvoiceLineItemLinkageWithoutLineInvoiceId,
];

for (const run of tests) {
  run();
}

console.log(`operational-invoice-linkage: ${tests.length} passed`);
