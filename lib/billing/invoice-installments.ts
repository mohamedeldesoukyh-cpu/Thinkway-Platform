import type { SupabaseClient } from "@supabase/supabase-js";

type InvoiceHistory = { id: string; created_at: string; status: string };
type AssignmentInvoice = { invoice_id: string; campaign_line_id: string | null; revenue_before_vat: number };

/** Count invoices, not posts: one invoice can contain many rows for one assignment. */
export function assignmentInstallmentNumbers(
  invoiceId: string,
  invoices: InvoiceHistory[],
  lines: AssignmentInvoice[],
): Map<string, number> {
  const ordered = [...invoices].filter(invoice => invoice.status !== "void")
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const current = ordered.findIndex(invoice => invoice.id === invoiceId);
  if (current < 0) return new Map();
  const positions = new Map(ordered.map((invoice, index) => [invoice.id, index]));
  const byAssignment = new Map<string, Set<string>>();
  for (const line of lines) {
    const position = positions.get(line.invoice_id);
    if (!line.campaign_line_id || !(Number(line.revenue_before_vat) > 0) || position == null || position > current) continue;
    const ids = byAssignment.get(line.campaign_line_id) ?? new Set<string>();
    ids.add(line.invoice_id);
    byAssignment.set(line.campaign_line_id, ids);
  }
  return new Map([...byAssignment].filter(([, ids]) => ids.has(invoiceId)).map(([id, ids]) => [id, ids.size]));
}

export function invoiceInstallmentLabel(ordinal: number | undefined, description: string): string | null {
  if (!ordinal || !Number.isInteger(ordinal) || ordinal < 1) return null;
  const suffix = ordinal % 100 >= 11 && ordinal % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[ordinal % 10] ?? "th";
  // Use the persisted billing percentage, never a guess from the remaining balance.
  const percentage = description.match(/(\d+(?:\.\d+)?)% of original billable amount/)?.[1];
  return `${ordinal}${suffix} installment${percentage ? ` — ${percentage}%` : ""}`;
}

/** Read only, scoped to assignments already authorized by the invoice document loader. */
export async function loadAssignmentInstallmentNumbers(db: SupabaseClient, invoiceId: string, assignmentIds: string[]): Promise<Map<string, number>> {
  if (!assignmentIds.length) return new Map();
  const lines: AssignmentInvoice[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("invoice_line_items")
      .select("invoice_id, campaign_line_id, revenue_before_vat").in("campaign_line_id", assignmentIds)
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Unable to verify invoice installment history.");
    lines.push(...(data ?? []));
    if ((data?.length ?? 0) < 500) break;
  }
  const invoiceIds = [...new Set(lines.map(line => line.invoice_id))];
  if (!invoiceIds.length) return new Map();
  const invoices: InvoiceHistory[] = [];
  for (let offset = 0; offset < invoiceIds.length; offset += 100) {
    const { data, error } = await db.from("invoices")
      .select("id, created_at, status").in("id", invoiceIds.slice(offset, offset + 100));
    if (error) throw new Error("Unable to verify invoice installment history.");
    invoices.push(...(data ?? []));
  }
  return assignmentInstallmentNumbers(invoiceId, invoices, lines);
}
