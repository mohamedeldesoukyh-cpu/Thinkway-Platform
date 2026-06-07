import type { AssignmentRowViewModel } from "@/lib/campaigns/assignment-row-view-model";
import type { AssignmentHierarchyGroup } from "@/features/campaigns/types/assignment-hierarchy";
import { analyzeAssignmentGroupsCoverage } from "@/lib/operations/io-coverage-server";
import type { IoCoverageAnalysis } from "@/lib/operations/io-coverage";
import {
  canRegenerateInvoice,
  enrichRegenerationEligibilityInput,
  hasInvoiceLinkage,
  isAssignmentInvoiceSelectable,
  isInvoiceLifecycleReopenable,
  resolveInvoiceActionForSelection,
  type RegenerationEligibilityInput,
} from "@/lib/billing/regeneration-eligibility";
import type { AssignmentHierarchyBillingContext } from "@/features/campaigns/types/assignment-hierarchy";

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

function rowEligibilityInput(
  row: SelectionActionRowInput,
  billingContext?: AssignmentHierarchyBillingContext | null
): RegenerationEligibilityInput {
  const line = row.group.line;
  return enrichRegenerationEligibilityInput(
    {
      billing_status: line.billing_status,
      operational_status: line.operational_status,
      vendor_io_id: line.vendor_io_id,
      active_vendor_io_id: line.active_vendor_io_id,
      vendor_io_document_number: line.vendor_io_document_number,
      invoice_id: line.invoice_id,
      finance_override_until: line.finance_override_until,
      remaining_amount: row.meta?.remaining ?? row.group.rollups?.remaining_value,
      billable_amount: row.group.rollups?.revenue ?? line.revenue_before_vat ?? line.revenue,
      invoiced_amount: row.group.rollups?.invoiced_value,
    },
    billingContext
  );
}

function isDeliverableInvoiceActionEligible(
  deliverable: AssignmentHierarchyGroup["deliverables"][number],
  line: SelectionActionRowInput,
  billingContext?: AssignmentHierarchyBillingContext | null
): boolean {
  if (deliverable.is_synthetic) return false;
  if (TERMINAL_BILLING.has(deliverable.billing_status)) return false;
  if (["cancelled", "disputed"].includes(deliverable.billing_status)) return false;

  const remaining = Number(deliverable.remaining_amount ?? 0);
  if (remaining > 0 && !deliverable.is_locked) return true;

  return canRegenerateInvoice({
    ...rowEligibilityInput(line, billingContext),
    remaining_amount: deliverable.remaining_amount,
    invoiced_amount: deliverable.invoiced_amount,
  });
}

/** Invoice/regenerate action eligibility from remaining revenue OR reversible lifecycle. */
export function hasRemainingInvoiceableAssignment(
  row: SelectionActionRowInput,
  billingContext?: AssignmentHierarchyBillingContext | null
): boolean {
  return isAssignmentInvoiceSelectable(rowEligibilityInput(row, billingContext));
}

export function getInvoiceableSelectedAssignments(input: {
  selectedLineIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
  billingContext?: AssignmentHierarchyBillingContext | null;
}): string[] {
  const selected = new Set(input.selectedLineIds);
  const lineIds: string[] = [];

  for (const row of input.preparedRows) {
    if (!selected.has(row.lineId)) continue;
    if (!hasRemainingInvoiceableAssignment(row, input.billingContext)) continue;
    lineIds.push(row.lineId);
  }

  return lineIds;
}

export function getInvoiceableSelectedDeliverables(input: {
  selectedDeliverableIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
  billingContext?: AssignmentHierarchyBillingContext | null;
}): string[] {
  const selected = new Set(input.selectedDeliverableIds);
  const deliverableIds: string[] = [];

  for (const row of input.preparedRows) {
    const pricingMode = row.group.line.assignment?.pricing_mode ?? "package";
    if (pricingMode !== "per_deliverable") continue;

    for (const deliverable of row.group.deliverables ?? []) {
      if (!selected.has(deliverable.id)) continue;
      if (!isDeliverableInvoiceActionEligible(deliverable, row, input.billingContext)) {
        continue;
      }
      deliverableIds.push(deliverable.id);
    }
  }

  return deliverableIds;
}

export function hasInvoiceableSelection(input: {
  selectedLineIds: Iterable<string>;
  selectedDeliverableIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
  billingContext?: AssignmentHierarchyBillingContext | null;
}): boolean {
  const invoiceLineIds = getInvoiceableSelectedAssignments({
    selectedLineIds: input.selectedLineIds,
    preparedRows: input.preparedRows,
    billingContext: input.billingContext,
  });
  if (invoiceLineIds.length > 0) return true;

  const deliverableIds = getInvoiceableSelectedDeliverables({
    selectedDeliverableIds: input.selectedDeliverableIds,
    preparedRows: input.preparedRows,
    billingContext: input.billingContext,
  });
  return deliverableIds.length > 0;
}

/** Footer action visibility — invoice actions win over revise/ungenerate for mixed selections. */
export function resolveSelectionActions(input: {
  selectedLineIds: Iterable<string>;
  selectedDeliverableIds: Iterable<string>;
  preparedRows: SelectionActionRowInput[];
  billingContext?: AssignmentHierarchyBillingContext | null;
}): ResolvedSelectionActions {
  const selected = new Set(input.selectedLineIds);
  const billingContext = input.billingContext;

  const selectableLineIds = getInvoiceableSelectedAssignments({
    selectedLineIds: input.selectedLineIds,
    preparedRows: input.preparedRows,
    billingContext,
  });

  const getRow = (lineId: string) => {
    const row = input.preparedRows.find((entry) => entry.lineId === lineId);
    return row ? rowEligibilityInput(row, billingContext) : null;
  };

  const invoiceAction = resolveInvoiceActionForSelection({
    lineIds: selectableLineIds,
    getRow,
  });

  const invoiceLineIds = invoiceAction.actionLineIds;
  const invoiceableLineSet = new Set(invoiceLineIds);

  const invoiceDeliverableIds = getInvoiceableSelectedDeliverables({
    selectedDeliverableIds: input.selectedDeliverableIds,
    preparedRows: input.preparedRows,
    billingContext,
  });

  const hasInvoiceSelection =
    invoiceLineIds.length > 0 || invoiceDeliverableIds.length > 0;

  const invoiceActionLabel = invoiceAction.action;

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
      !hasInvoiceLinkage(rowEligibilityInput(row, billingContext)) &&
      !isInvoiceLifecycleReopenable(rowEligibilityInput(row, billingContext))
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
