import type { OperationalBillingRow } from "./operational-billing-rows";
import { collectBillingLeaves, buildInvoiceDraftSubmit, type InvoiceDraftPercents } from "./operational-invoice-draft";
import { isRowInInvoiceSubmitPayload, type OperationalSelectionPayload } from "./operational-selection";

export type InvoiceGrouping = "combined" | "separate";

/** Partition the exact selected ids by assignment; never expand to unselected siblings. */
export function splitInvoiceSelection(rows: OperationalBillingRow[], selection: OperationalSelectionPayload): OperationalSelectionPayload[] {
  return rows.flatMap(root => {
    const ids = new Set<string>();
    const visit = (row: OperationalBillingRow) => { ids.add(row.id); row.children.forEach(visit); };
    visit(root);
    const group = {
      line_ids: selection.line_ids.filter(id => ids.has(id)),
      deliverable_ids: selection.deliverable_ids.filter(id => ids.has(id)),
      post_ids: selection.post_ids.filter(id => ids.has(id)),
    };
    return group.line_ids.length + group.deliverable_ids.length + group.post_ids.length ? [group] : [];
  });
}

export function selectedInvoiceRows(rows: OperationalBillingRow[], selection: OperationalSelectionPayload): OperationalBillingRow[] {
  return collectBillingLeaves(rows).filter(row => isRowInInvoiceSubmitPayload(row, selection));
}

export function separateInvoiceCount(rows: OperationalBillingRow[], percents: InvoiceDraftPercents, selection: OperationalSelectionPayload): number {
  return splitInvoiceSelection(rows, buildInvoiceDraftSubmit(rows, percents, selection).payload).length;
}

export function invoicePercentageDescription(description: string, billed: number, original: number): string {
  if (!(original > 0) || !(billed > 0) || billed >= original - 0.01) return description;
  const percent = Math.round(billed / original * 10000) / 100;
  return `${description} · ${percent}% of original billable amount`;
}

/** Stop on failure; report completed invoices so the UI never blindly retries them. */
export async function runSeparateInvoices<T extends { ok: boolean; message?: string; invoiceId?: string }>(
  groups: OperationalSelectionPayload[],
  create: (group: OperationalSelectionPayload) => Promise<T>,
): Promise<{ completed: T[]; failure?: T; error?: string }> {
  const completed: T[] = [];
  for (const group of groups) {
    try {
      const result = await create(group);
      if (!result.ok) return { completed, failure: result };
      completed.push(result);
    } catch (error) {
      return { completed, error: error instanceof Error ? error.message : "Invoice generation failed." };
    }
  }
  return { completed };
}
