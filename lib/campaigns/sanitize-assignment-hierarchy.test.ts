/**
 * Run: npx tsx lib/campaigns/sanitize-assignment-hierarchy.test.ts
 */
import { sanitizeAssignmentHierarchyGroup } from "@/lib/campaigns/sanitize-assignment-hierarchy";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testFullyInvoicedDeliverablesShowInvoicedLineBilling() {
  const group: AssignmentHierarchyGroup = {
    line: {
      id: "line-1",
      name: "Creator A",
      billing_status: "moved_to_billing",
      operational_status: "io_generated",
      vendor_io_id: "vio-1",
      invoice_id: null,
      revenue: 2000,
      cost: 800,
      gp: 1200,
      margin_percent: 60,
      deliverable_count: 2,
    } as AssignmentHierarchyGroup["line"],
    deliverables: [
      {
        id: "del-1",
        campaign_line_id: "line-1",
        sort_order: 1,
        label: "Reel",
        platform: "instagram",
        deliverable_type: "instagram_reel",
        deliverable_type_label: "Reel",
        quantity: 1,
        unit_cost: 400,
        unit_revenue: 1000,
        revenue_before_vat: 1000,
        cost_before_vat: 400,
        revenue_vat_percent: 0,
        revenue_vat_amount: 0,
        revenue_after_vat: 1000,
        cost_vat_amount: 0,
        billing_status: "invoiced",
        invoice_id: "inv-1",
        remaining_amount: 0,
        invoiced_amount: 1000,
        invoice_eligible: false,
        is_locked: true,
        posts: [],
      } as unknown as AssignmentHierarchyGroup["deliverables"][number],
      {
        id: "del-2",
        campaign_line_id: "line-1",
        sort_order: 2,
        label: "Story",
        platform: "instagram",
        deliverable_type: "instagram_story",
        deliverable_type_label: "Story",
        quantity: 1,
        unit_cost: 400,
        unit_revenue: 1000,
        revenue_before_vat: 1000,
        cost_before_vat: 400,
        revenue_vat_percent: 0,
        revenue_vat_amount: 0,
        revenue_after_vat: 1000,
        cost_vat_amount: 0,
        billing_status: "invoiced",
        invoice_id: "inv-1",
        remaining_amount: 0,
        invoiced_amount: 1000,
        invoice_eligible: false,
        is_locked: true,
        posts: [],
      } as unknown as AssignmentHierarchyGroup["deliverables"][number],
    ],
    rollups: {
      deliverable_count: 2,
      revenue: 2000,
      cost: 800,
      gp: 1200,
      margin_percent: 60,
      invoiced_value: 2000,
      remaining_value: 0,
      collected_value: 0,
    },
  };

  const sanitized = sanitizeAssignmentHierarchyGroup(group);
  assert(sanitized != null, "group should sanitize");
  const result = sanitized!;
  assert(
    result.line.billing_status === "invoiced",
    `expected invoiced billing display, got ${result.line.billing_status}`
  );
  assert(
    result.line.invoice_id === "inv-1",
    `expected derived invoice_id inv-1, got ${result.line.invoice_id}`
  );
}

function testInvoicedDeliverableStatusWithoutInvoiceLinkStaysMovedToBilling() {
  const group: AssignmentHierarchyGroup = {
    line: {
      id: "line-1",
      name: "Creator A",
      billing_status: "moved_to_billing",
      operational_status: "io_generated",
      vendor_io_id: "vio-1",
      invoice_id: null,
      revenue: 2000,
      cost: 800,
      gp: 1200,
      margin_percent: 60,
      deliverable_count: 2,
    } as AssignmentHierarchyGroup["line"],
    deliverables: [
      {
        id: "del-1",
        campaign_line_id: "line-1",
        sort_order: 1,
        label: "Reel",
        platform: "instagram",
        deliverable_type: "instagram_reel",
        deliverable_type_label: "Reel",
        quantity: 1,
        unit_cost: 400,
        unit_revenue: 1000,
        live_date: null,
        notes: null,
        revenue_before_vat: 1000,
        cost_before_vat: 400,
        revenue_vat_percent: 0,
        revenue_vat_amount: 0,
        revenue_after_vat: 1000,
        cost_vat_amount: 0,
        billing_status: "invoiced",
        invoice_id: null,
        remaining_amount: 0,
        invoiced_amount: 1000,
        invoice_eligible: false,
        is_locked: true,
        posts: [],
      } as unknown as AssignmentHierarchyGroup["deliverables"][number],
    ],
    rollups: {
      deliverable_count: 1,
      revenue: 1000,
      cost: 400,
      gp: 600,
      margin_percent: 60,
      invoiced_value: 1000,
      remaining_value: 0,
      collected_value: 0,
    },
  };

  const sanitized = sanitizeAssignmentHierarchyGroup(group);
  assert(sanitized != null, "group should sanitize");
  const result = sanitized!;
  assert(
    result.line.billing_status === "moved_to_billing",
    `orphan invoiced deliverable must not upgrade line display, got ${result.line.billing_status}`
  );
}

const tests = [
  testFullyInvoicedDeliverablesShowInvoicedLineBilling,
  testInvoicedDeliverableStatusWithoutInvoiceLinkStaysMovedToBilling,
];

for (const run of tests) {
  run();
}

console.log(`sanitize-assignment-hierarchy: ${tests.length} passed`);
