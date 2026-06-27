import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentHierarchyGroup } from "@/lib/domains/campaign/assignment-hierarchy-types";
import { isLineInvoiceEligible } from "@/lib/billing/line-invoice-eligibility";
import { getRemainingRevenue } from "@/lib/billing/partial-invoice-lifecycle";

export type InvoiceableSelection = {
  lineIds: string[];
  deliverableIds: string[];
};

export type InvoiceActionRowInput = {
  lineId: string;
  group: AssignmentHierarchyGroup;
  meta?: AssignmentRowViewModel["meta"];
};

function isDeliverableInvoiceable(
  deliverable: AssignmentHierarchyGroup["deliverables"][number]
): boolean {
  return Boolean(deliverable.invoice_eligible) && !deliverable.is_synthetic;
}

function resolveLineInvoiceEligible(input: InvoiceActionRowInput): boolean {
  if (input.meta?.invoiceEligible) return true;

  const line = input.group.line;
  const pricingMode = line.assignment?.pricing_mode ?? "package";
  const hasDeliverableBreakdown = (input.group.deliverables?.length ?? 0) > 0;
  if (pricingMode === "per_deliverable" && hasDeliverableBreakdown) return false;

  const remaining = getRemainingRevenue({
    remaining_amount: input.meta?.remaining,
    billable_amount: input.group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
    invoiced_amount: input.group.rollups?.invoiced_value,
  });

  return isLineInvoiceEligible({
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    billing_status: line.billing_status,
    is_locked: line.revenue_locked,
    remaining_amount: remaining,
    invoice_id: line.invoice_id,
  });
}

/** Invoiceable subset — fully invoiced lines are excluded individually, not as a batch block. */
export function getInvoiceableSelections(input: {
  selectedLineIds: Iterable<string>;
  selectedDeliverableIds: Iterable<string>;
  preparedRows: InvoiceActionRowInput[];
}): InvoiceableSelection {
  const selectedLines = new Set(input.selectedLineIds);
  const selectedDeliverables = new Set(input.selectedDeliverableIds);

  const lineIds: string[] = [];
  const deliverableIds: string[] = [];

  for (const row of input.preparedRows) {
    if (selectedLines.has(row.lineId) && resolveLineInvoiceEligible(row)) {
      lineIds.push(row.lineId);
    }

    const pricingMode = row.group.line.assignment?.pricing_mode ?? "package";
    if (pricingMode !== "per_deliverable") continue;

    for (const deliverable of row.group.deliverables ?? []) {
      if (
        selectedDeliverables.has(deliverable.id) &&
        isDeliverableInvoiceable(deliverable)
      ) {
        deliverableIds.push(deliverable.id);
      }
    }
  }

  return { lineIds, deliverableIds };
}

export function canGenerateInvoiceForSelection(input: {
  selectedLineIds: Iterable<string>;
  selectedDeliverableIds: Iterable<string>;
  preparedRows: InvoiceActionRowInput[];
}): boolean {
  const { lineIds, deliverableIds } = getInvoiceableSelections(input);
  return lineIds.length > 0 || deliverableIds.length > 0;
}
