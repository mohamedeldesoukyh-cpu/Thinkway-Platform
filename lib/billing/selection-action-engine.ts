import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import {
  getRemainingRevenue,
  isFullyInvoicedBillingStatus,
} from "@/lib/billing/partial-invoice-lifecycle";

export type SelectionActionRowInput = {
  lineId: string;
  group: AssignmentHierarchyGroup;
  meta?: AssignmentRowViewModel["meta"];
};

export type ResolvedSelectionActions = {
  invoiceLineIds: string[];
  invoiceDeliverableIds: string[];
  vioLineIds: string[];
  reviseVioLineIds: string[];
  ungenerateIoLineIds: string[];
  hasInvoiceSelection: boolean;
  showGenerateInvoice: boolean;
};

function isDeliverableInvoiceable(
  deliverable: AssignmentHierarchyGroup["deliverables"][number]
): boolean {
  if (deliverable.is_synthetic) return false;
  const remaining = Number(deliverable.remaining_amount ?? 0);
  if (remaining <= 0) return false;
  if (deliverable.is_locked) return false;
  if (["invoiced", "collected", "cancelled", "disputed"].includes(deliverable.billing_status)) {
    return false;
  }
  return true;
}

/** Remaining invoiceable revenue — sole gate for invoice actions. */
export function hasRemainingInvoiceableAssignment(row: SelectionActionRowInput): boolean {
  const line = row.group.line;
  if (!line.vendor_io_id) return false;

  const billing = line.billing_status ?? "";
  if (isFullyInvoicedBillingStatus(billing)) return false;

  const remaining = getRemainingRevenue({
    remaining_amount: row.meta?.remaining ?? row.group.rollups?.remaining_value,
    billable_amount: row.group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
    invoiced_amount: row.group.rollups?.invoiced_value,
  });

  return remaining > 0;
}

export function getInvoiceableSelectedAssignments(input: {
  selectedLineIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
}): string[] {
  const selected = new Set(input.selectedLineIds);
  const lineIds: string[] = [];

  for (const row of input.preparedRows) {
    if (!selected.has(row.lineId)) continue;
    if (!hasRemainingInvoiceableAssignment(row)) continue;
    lineIds.push(row.lineId);
  }

  return lineIds;
}

export function getInvoiceableSelectedDeliverables(input: {
  selectedDeliverableIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
  invoiceableLineIds: Set<string>;
}): string[] {
  const selected = new Set(input.selectedDeliverableIds);
  const deliverableIds: string[] = [];

  for (const row of input.preparedRows) {
    const pricingMode = row.group.line.assignment?.pricing_mode ?? "package";
    if (pricingMode !== "per_deliverable") continue;

    for (const deliverable of row.group.deliverables ?? []) {
      if (!selected.has(deliverable.id)) continue;
      if (!isDeliverableInvoiceable(deliverable)) continue;
      deliverableIds.push(deliverable.id);
    }
  }

  return deliverableIds;
}

export function hasInvoiceableSelection(input: {
  selectedLineIds: Iterable<string>;
  selectedDeliverableIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
}): boolean {
  const invoiceLineIds = getInvoiceableSelectedAssignments({
    selectedLineIds: input.selectedLineIds,
    preparedRows: input.preparedRows,
  });
  if (invoiceLineIds.length > 0) return true;

  const deliverableIds = getInvoiceableSelectedDeliverables({
    selectedDeliverableIds: input.selectedDeliverableIds,
    preparedRows: input.preparedRows,
    invoiceableLineIds: new Set(invoiceLineIds),
  });
  return deliverableIds.length > 0;
}

/** Footer action visibility — invoice actions win over revise/ungenerate for mixed selections. */
export function resolveSelectionActions(input: {
  selectedLineIds: Iterable<string>;
  selectedDeliverableIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
}): ResolvedSelectionActions {
  const selected = new Set(input.selectedLineIds);

  const invoiceLineIds = getInvoiceableSelectedAssignments({
    selectedLineIds: input.selectedLineIds,
    preparedRows: input.preparedRows,
  });
  const invoiceableLineSet = new Set(invoiceLineIds);

  const invoiceDeliverableIds = getInvoiceableSelectedDeliverables({
    selectedDeliverableIds: input.selectedDeliverableIds,
    preparedRows: input.preparedRows,
    invoiceableLineIds: invoiceableLineSet,
  });

  const hasInvoiceSelection =
    invoiceLineIds.length > 0 || invoiceDeliverableIds.length > 0;

  const vioLineIds: string[] = [];
  const reviseVioLineIds: string[] = [];
  const ungenerateIoLineIds: string[] = [];

  for (const row of input.preparedRows) {
    if (!selected.has(row.lineId)) continue;
    const meta = row.meta;
    const invoiceable = invoiceableLineSet.has(row.lineId);

    if (meta?.vioEligible) {
      vioLineIds.push(row.lineId);
    }

    if (!invoiceable && meta?.reviseVioEligible) {
      reviseVioLineIds.push(row.lineId);
    }

    if (!invoiceable && meta?.ungenerateIoEligible) {
      ungenerateIoLineIds.push(row.lineId);
    }
  }

  return {
    invoiceLineIds,
    invoiceDeliverableIds,
    vioLineIds,
    reviseVioLineIds,
    ungenerateIoLineIds,
    hasInvoiceSelection,
    showGenerateInvoice: hasInvoiceSelection,
  };
}
