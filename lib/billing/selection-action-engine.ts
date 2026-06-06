import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import { analyzeAssignmentGroupsCoverage } from "@/lib/operations/io-coverage-server";
import type { IoCoverageAnalysis } from "@/lib/operations/io-coverage";
import {
  canRegenerateInvoice,
  hasInvoiceLinkage,
  hasRegeneratableRevenue,
  isInvoiceLifecycleReopenable,
  resolveInvoiceActionLabel,
  type RegenerationEligibilityInput,
} from "@/lib/billing/regeneration-eligibility";

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
  invoiceActionLabel: "generate" | "regenerate" | null;
  ioCoverage: IoCoverageAnalysis | null;
};

const TERMINAL_BILLING = new Set(["void", "cancelled", "closed"]);

function rowEligibilityInput(row: SelectionActionRowInput): RegenerationEligibilityInput {
  const line = row.group.line;
  return {
    billing_status: line.billing_status,
    operational_status: line.operational_status,
    vendor_io_id: line.vendor_io_id,
    active_vendor_io_id: line.active_vendor_io_id,
    vendor_io_document_number: line.vendor_io_document_number,
    invoice_id: line.invoice_id,
    remaining_amount: row.meta?.remaining ?? row.group.rollups?.remaining_value,
    billable_amount: row.group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
    invoiced_amount: row.group.rollups?.invoiced_value,
  };
}

function isDeliverableInvoiceActionEligible(
  deliverable: AssignmentHierarchyGroup["deliverables"][number],
  line: SelectionActionRowInput
): boolean {
  if (deliverable.is_synthetic) return false;
  if (TERMINAL_BILLING.has(deliverable.billing_status)) return false;
  if (["cancelled", "disputed"].includes(deliverable.billing_status)) return false;

  const remaining = Number(deliverable.remaining_amount ?? 0);
  if (remaining > 0 && !deliverable.is_locked) return true;

  return canRegenerateInvoice({
    ...rowEligibilityInput(line),
    remaining_amount: deliverable.remaining_amount,
    invoiced_amount: deliverable.invoiced_amount,
  });
}

/** Invoice/regenerate action eligibility from remaining revenue OR reversible lifecycle. */
export function hasRemainingInvoiceableAssignment(row: SelectionActionRowInput): boolean {
  return canRegenerateInvoice(rowEligibilityInput(row));
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
}): string[] {
  const selected = new Set(input.selectedDeliverableIds);
  const deliverableIds: string[] = [];

  for (const row of input.preparedRows) {
    const pricingMode = row.group.line.assignment?.pricing_mode ?? "package";
    if (pricingMode !== "per_deliverable") continue;

    for (const deliverable of row.group.deliverables ?? []) {
      if (!selected.has(deliverable.id)) continue;
      if (!isDeliverableInvoiceActionEligible(deliverable, row)) continue;
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
  });

  const hasInvoiceSelection =
    invoiceLineIds.length > 0 || invoiceDeliverableIds.length > 0;

  const invoiceActionLabel = resolveInvoiceActionLabel({
    invoiceLineIds,
    getRow: (lineId) => {
      const row = input.preparedRows.find((entry) => entry.lineId === lineId);
      return row ? rowEligibilityInput(row) : null;
    },
  });

  const coverageLineIds = [
    ...new Set([...invoiceLineIds, ...deriveLineIdsForDeliverables(input, invoiceDeliverableIds)]),
  ];

  const ioCoverage =
    coverageLineIds.length > 0 || invoiceDeliverableIds.length > 0
      ? analyzeAssignmentGroupsCoverage({
          groups: input.preparedRows.map((r) => r.group),
          scope: {
            lineIds: coverageLineIds,
            deliverableIds:
              invoiceDeliverableIds.length > 0 ? invoiceDeliverableIds : undefined,
          },
          mode: invoiceActionLabel === "regenerate" ? "regenerate" : "generate",
        })
      : null;

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

    if (
      !invoiceable &&
      meta?.reviseVioEligible &&
      (!ioCoverage || ioCoverage.revised_line_ids.includes(row.lineId))
    ) {
      reviseVioLineIds.push(row.lineId);
    }

    if (
      !invoiceable &&
      meta?.ungenerateIoEligible &&
      !hasInvoiceLinkage(rowEligibilityInput(row)) &&
      !isInvoiceLifecycleReopenable(rowEligibilityInput(row))
    ) {
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
    invoiceActionLabel,
    ioCoverage,
  };
}

function deriveLineIdsForDeliverables(
  input: {
    preparedRows: SelectionActionRowInput[];
  },
  deliverableIds: string[]
): string[] {
  if (deliverableIds.length === 0) return [];
  const deliverableSet = new Set(deliverableIds);
  const lineIds: string[] = [];
  for (const row of input.preparedRows) {
    const hasSelectedDeliverable = (row.group.deliverables ?? []).some((d) =>
      deliverableSet.has(d.id)
    );
    if (hasSelectedDeliverable) lineIds.push(row.lineId);
  }
  return lineIds;
}
