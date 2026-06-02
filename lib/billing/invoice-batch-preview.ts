import type { DeliverableBillingRow } from "@/lib/billing/deliverable-billing";
import {
  resolveInvoiceLineBeforeVat,
  resolveInvoiceLineVatPercent,
} from "@/lib/billing/invoice-from-deliverables";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import type { OperationalSelectionState } from "@/lib/billing/operational-selection";
import {
  aggregateInvoiceTotals,
  computeVatLine,
  type VatLineResult,
} from "@/lib/vat/calculations";

export type InvoiceBatchFinancialPreview = {
  deliverableCount: number;
  subtotal: number;
  taxAmount: number;
  totalAfterVat: number;
  mixedVat: boolean;
  displayVatPercent: number | null;
  vatLines: VatLineResult[];
  alreadyInvoiced: number;
  remainingAfterInvoice: number;
  appendCurrentTotal: number | null;
  appendNewTotal: number | null;
};

function isPreviewEligibleDeliverable(row: OperationalBillingRow): boolean {
  if (row.kind !== "deliverable_group") return false;
  if (row.is_locked || row.remaining_amount <= 0) return false;
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") return false;
  return true;
}

function isPreviewEligibleLegacyAssignment(row: OperationalBillingRow): boolean {
  if (row.kind !== "assignment" || !row.is_legacy_synthetic) return false;
  if (row.is_locked || row.remaining_amount <= 0) return false;
  return true;
}

/** Mirrors server deliverable resolution from selection payload (line / deliverable / post ids). */
export function resolvePreviewDeliverableRows(
  operationalRows: OperationalBillingRow[],
  selection: OperationalSelectionState
): OperationalBillingRow[] {
  const ids = new Set<string>(selection.deliverable_ids);
  const byId = new Map<string, OperationalBillingRow>();

  for (const assignment of operationalRows) {
    for (const deliverable of assignment.children) {
      if (deliverable.kind === "deliverable_group") {
        byId.set(deliverable.id, deliverable);
      }
    }
  }

  for (const assignment of operationalRows) {
    if (selection.line_ids.has(assignment.id)) {
      for (const deliverable of assignment.children) {
        if (isPreviewEligibleDeliverable(deliverable)) {
          ids.add(deliverable.id);
        }
      }
    }
  }

  for (const assignment of operationalRows) {
    for (const deliverable of assignment.children) {
      for (const post of deliverable.children) {
        if (post.kind === "post" && selection.post_ids.has(post.id)) {
          if (isPreviewEligibleDeliverable(deliverable)) {
            ids.add(deliverable.id);
          }
        }
      }
    }
  }

  return [...ids]
    .map((id) => byId.get(id))
    .filter((row): row is OperationalBillingRow => Boolean(row));
}

function operationalRowToDeliverable(row: OperationalBillingRow): DeliverableBillingRow {
  return {
    id: row.id,
    campaign_line_id: row.campaign_line_id,
    sort_order: 0,
    platform: row.platform ?? "",
    deliverable_type: row.deliverable_type ?? "",
    quantity: 1,
    live_date: null,
    billable_amount: row.billable_amount,
    invoiced_amount: row.invoiced_amount,
    collected_amount: row.collected_amount,
    disputed_amount: 0,
    remaining_amount: row.remaining_amount,
    billing_status: row.billing_status as DeliverableBillingRow["billing_status"],
    invoice_line_item_id: row.invoice_line_item_id,
    locked_at: row.locked_at,
    revenue_before_vat: row.revenue_before_vat,
    revenue_vat_percent: row.revenue_vat_percent,
    revenue_vat_exempt: row.revenue_vat_exempt,
    label: row.label,
  };
}

function assignmentLineVatContext(assignment: OperationalBillingRow | undefined) {
  return {
    revenue_vat_percent:
      assignment?.line_revenue_vat_percent ?? assignment?.revenue_vat_percent ?? 0,
    revenue_vat_exempt:
      assignment?.line_revenue_vat_exempt ?? assignment?.revenue_vat_exempt ?? false,
  };
}

function buildPreviewVatLines(
  operationalRows: OperationalBillingRow[],
  selection: OperationalSelectionState,
  defaultVatPercent: number
): VatLineResult[] {
  const assignmentByLineId = new Map(
    operationalRows.filter((r) => r.kind === "assignment").map((r) => [r.id, r])
  );
  const deliverableRows = resolvePreviewDeliverableRows(operationalRows, selection);
  const lines: VatLineResult[] = [];

  for (const row of deliverableRows) {
    const assignment = assignmentByLineId.get(row.campaign_line_id);
    const deliverable = operationalRowToDeliverable(row);
    const lineVat = assignmentLineVatContext(assignment);
    const beforeVat = resolveInvoiceLineBeforeVat(deliverable);
    const vatPercent = resolveInvoiceLineVatPercent(deliverable, lineVat, defaultVatPercent);
    const exempt = deliverable.revenue_vat_exempt || Boolean(lineVat.revenue_vat_exempt);
    lines.push(computeVatLine({ beforeVat, vatPercent, exempt }));
  }

  if (lines.length === 0) {
    for (const assignment of operationalRows) {
      if (!selection.line_ids.has(assignment.id)) continue;
      if (!isPreviewEligibleLegacyAssignment(assignment)) continue;
      const deliverable = operationalRowToDeliverable(assignment);
      const lineVat = assignmentLineVatContext(assignment);
      const beforeVat = resolveInvoiceLineBeforeVat(deliverable);
      const vatPercent = resolveInvoiceLineVatPercent(deliverable, lineVat, defaultVatPercent);
      const exempt = deliverable.revenue_vat_exempt || Boolean(lineVat.revenue_vat_exempt);
      lines.push(computeVatLine({ beforeVat, vatPercent, exempt }));
    }
  }

  return lines;
}

export function computeInvoiceBatchFinancialPreview(input: {
  operationalRows: OperationalBillingRow[];
  selection: OperationalSelectionState;
  defaultVatPercent: number;
  campaignRollup: {
    already_invoiced: number;
    remaining_to_invoice: number;
  };
  appendInvoice?: { total: number } | null;
}): InvoiceBatchFinancialPreview {
  const vatLines = buildPreviewVatLines(
    input.operationalRows,
    input.selection,
    input.defaultVatPercent
  );
  const totals = aggregateInvoiceTotals(vatLines);
  const rateKeys = new Set(
    vatLines.map((line) => (line.exempt ? "exempt" : String(line.vatPercent)))
  );
  const mixedVat = rateKeys.size > 1;
  const nonExemptPercents = [
    ...new Set(
      vatLines.filter((line) => !line.exempt).map((line) => line.vatPercent)
    ),
  ];
  const displayVatPercent =
    !mixedVat && nonExemptPercents.length === 1 ? nonExemptPercents[0]! : null;

  const subtotal = totals.subtotal;
  const remainingAfterInvoice = Math.max(
    0,
    input.campaignRollup.remaining_to_invoice - subtotal
  );

  const appendCurrentTotal = input.appendInvoice
    ? Math.max(0, Number(input.appendInvoice.total) || 0)
    : null;
  const appendNewTotal =
    appendCurrentTotal != null
      ? Math.max(0, appendCurrentTotal + totals.total)
      : null;

  return {
    deliverableCount: vatLines.length,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAfterVat: totals.total,
    mixedVat,
    displayVatPercent,
    vatLines,
    alreadyInvoiced: input.campaignRollup.already_invoiced,
    remainingAfterInvoice,
    appendCurrentTotal,
    appendNewTotal,
  };
}
