/**
 * Live invoice draft on operational billing rows (percent cascade + rollup).
 * Spec: docs/capabilities/PARTIAL_ASSIGNMENT_INVOICE_SPEC.md
 */

import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import {
  isRowInInvoiceSubmitPayload,
  type OperationalSelectionPayload,
} from "@/lib/billing/operational-selection";
import {
  amountFromPercent,
  invoiceSliceKey,
  percentFromAmount,
  serializeInvoiceSliceAllocations,
  type InvoiceSliceGrain,
} from "@/lib/billing/partial-assignment-invoice";
import { computeVatLine, roundMoney } from "@/lib/vat/calculations";

/** Synthetic campaign rollup row — changing it cascades to every assignment. */
export const CAMPAIGN_INVOICE_DRAFT_ID = "__campaign__";

export type InvoiceDraftPercents = Record<string, number>;

export type InvoiceDraftLine = {
  amount: number;
  percent: number;
  toBeInvoiced: number;
  vatAmount: number;
  totalInvoice: number;
  remaining: number;
};

function grainFromRow(row: Pick<OperationalBillingRow, "kind">): InvoiceSliceGrain {
  if (row.kind === "deliverable_group") return "deliverable";
  return row.kind;
}

export function invoiceDraftKey(row: Pick<OperationalBillingRow, "kind" | "id">): string {
  return invoiceSliceKey(grainFromRow(row), row.id);
}

export function defaultInvoiceDraftPercent(
  row: Pick<OperationalBillingRow, "remaining_amount">
): number {
  return Number(row.remaining_amount) > 0.01 ? 100 : 0;
}

export function findOperationalRow(
  rows: OperationalBillingRow[],
  id: string
): OperationalBillingRow | null {
  for (const row of rows) {
    if (row.id === id) return row;
    const nested = findOperationalRow(row.children ?? [], id);
    if (nested) return nested;
  }
  return null;
}

export function collectSubtreeIds(row: OperationalBillingRow): string[] {
  const ids = [row.id];
  for (const child of row.children ?? []) {
    ids.push(...collectSubtreeIds(child));
  }
  return ids;
}

function childRemainingSum(row: OperationalBillingRow): number {
  return roundMoney(
    (row.children ?? []).reduce((sum, child) => sum + Math.max(0, child.remaining_amount), 0)
  );
}

/** Prefer nested remaining; if children have none, bill this row (package remaining). */
export function collectBillingLeaves(rows: OperationalBillingRow[]): OperationalBillingRow[] {
  const leaves: OperationalBillingRow[] = [];

  function walk(node: OperationalBillingRow) {
    const children = node.children ?? [];
    if (children.length > 0 && childRemainingSum(node) > 0.01) {
      for (const child of children) walk(child);
      return;
    }
    leaves.push(node);
  }

  for (const row of rows) walk(row);
  return leaves;
}

function capPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

/** Set Invoice % on a row and every descendant. Campaign id cascades to all assignments. */
export function cascadeInvoiceDraftPercent(
  rows: OperationalBillingRow[],
  rowId: string,
  percent: number,
  current: InvoiceDraftPercents
): InvoiceDraftPercents {
  const capped = capPercent(percent);
  const next = { ...current };

  if (rowId === CAMPAIGN_INVOICE_DRAFT_ID) {
    next[CAMPAIGN_INVOICE_DRAFT_ID] = capped;
    for (const root of rows) {
      for (const id of collectSubtreeIds(root)) {
        next[id] = capped;
      }
    }
    return next;
  }

  const node = findOperationalRow(rows, rowId);
  if (!node) return current;
  for (const id of collectSubtreeIds(node)) {
    next[id] = capped;
  }
  return next;
}

/** Set To Be Invoiced; converts to % of this row’s amount and cascades. */
export function cascadeInvoiceDraftToBeInvoiced(
  rows: OperationalBillingRow[],
  rowId: string,
  toBeInvoiced: number,
  current: InvoiceDraftPercents
): InvoiceDraftPercents {
  const requested = Math.max(0, Number(toBeInvoiced) || 0);
  const line =
    rowId === CAMPAIGN_INVOICE_DRAFT_ID
      ? computeCampaignInvoiceDraft(rows, current)
      : (() => {
          const node = findOperationalRow(rows, rowId);
          return node ? computeInvoiceDraftLine(node, current) : null;
        })();
  if (!line) return current;
  return cascadeInvoiceDraftPercent(
    rows,
    rowId,
    percentFromAmount(line.amount, requested),
    current
  );
}

function leafVatContext(row: OperationalBillingRow) {
  return {
    vatPercent: row.revenue_vat_percent || row.line_revenue_vat_percent || 0,
    exempt: Boolean(row.revenue_vat_exempt || row.line_revenue_vat_exempt),
  };
}

function storedPercent(row: OperationalBillingRow, percents: InvoiceDraftPercents): number {
  const value = percents[row.id];
  if (value != null && Number.isFinite(value)) return capPercent(value);
  const campaign = percents[CAMPAIGN_INVOICE_DRAFT_ID];
  if (campaign != null && Number.isFinite(campaign)) return capPercent(campaign);
  return defaultInvoiceDraftPercent(row);
}

function computeLeafDraft(
  row: OperationalBillingRow,
  percents: InvoiceDraftPercents
): InvoiceDraftLine {
  const amount = roundMoney(Math.max(0, row.remaining_amount));
  const percent = storedPercent(row, percents);
  const toBeInvoiced = amountFromPercent(amount, percent);
  const vat = computeVatLine({
    beforeVat: toBeInvoiced,
    vatPercent: leafVatContext(row).vatPercent,
    exempt: leafVatContext(row).exempt,
  });
  return {
    amount,
    percent: amount <= 0.01 ? 0 : percentFromAmount(amount, toBeInvoiced),
    toBeInvoiced,
    vatAmount: vat.vatAmount,
    totalInvoice: vat.afterVat,
    remaining: roundMoney(amount - toBeInvoiced),
  };
}

/**
 * Draft figures for a row. Parents with children roll up from descendants
 * (mixed 50%/100% → parent % = combined to-be-invoiced / combined amount).
 */
export function computeInvoiceDraftLine(
  row: OperationalBillingRow,
  percents: InvoiceDraftPercents
): InvoiceDraftLine {
  const children = row.children ?? [];
  if (children.length > 0 && childRemainingSum(row) > 0.01) {
    const childLines = children.map((child) => computeInvoiceDraftLine(child, percents));
    const amount = roundMoney(childLines.reduce((sum, line) => sum + line.amount, 0));
    const toBeInvoiced = roundMoney(
      childLines.reduce((sum, line) => sum + line.toBeInvoiced, 0)
    );
    const vatAmount = roundMoney(childLines.reduce((sum, line) => sum + line.vatAmount, 0));
    const remaining = roundMoney(amount - toBeInvoiced);
    return {
      amount,
      percent: percentFromAmount(amount, toBeInvoiced),
      toBeInvoiced,
      vatAmount,
      totalInvoice: roundMoney(toBeInvoiced + vatAmount),
      remaining,
    };
  }

  return computeLeafDraft(row, percents);
}

export function computeCampaignInvoiceDraft(
  assignments: OperationalBillingRow[],
  percents: InvoiceDraftPercents
): InvoiceDraftLine {
  const lines = assignments.map((row) => computeInvoiceDraftLine(row, percents));
  const amount = roundMoney(lines.reduce((sum, line) => sum + line.amount, 0));
  const toBeInvoiced = roundMoney(lines.reduce((sum, line) => sum + line.toBeInvoiced, 0));
  const vatAmount = roundMoney(lines.reduce((sum, line) => sum + line.vatAmount, 0));
  return {
    amount,
    percent: percentFromAmount(amount, toBeInvoiced),
    toBeInvoiced,
    vatAmount,
    totalInvoice: roundMoney(toBeInvoiced + vatAmount),
    remaining: roundMoney(amount - toBeInvoiced),
  };
}

function pushLeafToPayload(leaf: OperationalBillingRow, payload: OperationalSelectionPayload) {
  if (leaf.kind === "assignment") payload.line_ids.push(leaf.id);
  else if (leaf.kind === "deliverable_group") payload.deliverable_ids.push(leaf.id);
  else payload.post_ids.push(leaf.id);
}

/**
 * Selected leaves with To Be Invoiced > 0, plus billed amounts for create/append.
 * 0% rows are omitted so the server does not treat a missing key as 100%.
 */
export function buildInvoiceDraftSubmit(
  rows: OperationalBillingRow[],
  percents: InvoiceDraftPercents,
  selection: OperationalSelectionPayload
): { payload: OperationalSelectionPayload; allocations: Record<string, number> } {
  const payload: OperationalSelectionPayload = {
    line_ids: [],
    deliverable_ids: [],
    post_ids: [],
  };
  const allocations: Record<string, number> = {};

  for (const leaf of collectBillingLeaves(rows)) {
    if (!isRowInInvoiceSubmitPayload(leaf, selection)) continue;
    const draft = computeInvoiceDraftLine(leaf, percents);
    if (draft.toBeInvoiced <= 0.01) continue;
    allocations[invoiceDraftKey(leaf)] = draft.toBeInvoiced;
    pushLeafToPayload(leaf, payload);
  }

  return { payload, allocations };
}

export type InvoiceConfirmLinePreview = {
  id: string;
  label: string;
  documentNumber: string | null;
  influencerName: string | null;
  percent: number;
  toBeInvoiced: number;
  remaining: number;
};

export type InvoiceConfirmTotals = {
  thisInvoice: number;
  thisInvoiceVat: number;
  thisInvoiceTotal: number;
  remainingAfter: number;
  campaignTotal: number;
  alreadyInvoiced: number;
  lines: InvoiceConfirmLinePreview[];
};

/** Totals and line list for the invoice confirmation dialog. */
export function buildInvoiceConfirmPreview(input: {
  rows: OperationalBillingRow[];
  percents: InvoiceDraftPercents;
  selection: OperationalSelectionPayload;
  campaignTotal: number;
  alreadyInvoiced: number;
  remainingToInvoice: number;
}): InvoiceConfirmTotals {
  const bundle = buildInvoiceDraftSubmit(input.rows, input.percents, input.selection);
  const lines: InvoiceConfirmLinePreview[] = [];
  let thisInvoice = 0;
  let thisInvoiceVat = 0;

  for (const leaf of collectBillingLeaves(input.rows)) {
    if (!isRowInInvoiceSubmitPayload(leaf, bundle.payload)) continue;
    const draft = computeInvoiceDraftLine(leaf, input.percents);
    if (draft.toBeInvoiced <= 0.01) continue;
    thisInvoice += draft.toBeInvoiced;
    thisInvoiceVat += draft.vatAmount;
    lines.push({
      id: leaf.id,
      label: leaf.label,
      documentNumber: leaf.document_number,
      influencerName: leaf.influencer_name,
      percent: draft.percent,
      toBeInvoiced: draft.toBeInvoiced,
      remaining: draft.remaining,
    });
  }

  const billed = roundMoney(thisInvoice);
  const vat = roundMoney(thisInvoiceVat);
  return {
    campaignTotal: input.campaignTotal,
    alreadyInvoiced: input.alreadyInvoiced,
    thisInvoice: billed,
    thisInvoiceVat: vat,
    thisInvoiceTotal: roundMoney(billed + vat),
    remainingAfter: roundMoney(input.remainingToInvoice - billed),
    lines,
  };
}

export function buildCreateInvoiceFormData(input: {
  campaignId: string;
  payload: OperationalSelectionPayload;
  allocations: Record<string, number>;
  invoiceMode: "new" | "append";
  existingInvoiceId?: string;
}): FormData {
  const formData = new FormData();
  formData.set("campaign_id", input.campaignId);
  formData.set("line_ids", input.payload.line_ids.join(","));
  formData.set("deliverable_ids", input.payload.deliverable_ids.join(","));
  formData.set("post_ids", input.payload.post_ids.join(","));
  formData.set("invoice_mode", input.invoiceMode);
  formData.set(
    "existing_invoice_id",
    input.invoiceMode === "append" ? (input.existingInvoiceId ?? "") : ""
  );
  formData.set("allocations", serializeInvoiceSliceAllocations(input.allocations));
  return formData;
}
