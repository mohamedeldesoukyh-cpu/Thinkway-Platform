import type { SupabaseClient } from "@supabase/supabase-js";

export const ISSUED_INVOICE_PROTECTED = "Issued invoice amounts cannot be changed. Create a new invoice for remaining work, or use a credit/debit note for a correction.";

export function hasProtectedInvoiceAmounts(invoice: {
  status?: string | null;
  issue_date?: string | null;
  amounts_finalized_at?: string | null;
}): boolean {
  return Boolean(invoice.amounts_finalized_at || invoice.issue_date || (invoice.status && invoice.status !== "draft"));
}

/** Fail closed before any mutation, including operational unlinking. */
export async function invoiceAmountMutationError(db: SupabaseClient, invoiceId: string): Promise<string | null> {
  const { data, error } = await db.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error || !data) return "Unable to verify invoice protection. No changes were made.";
  return hasProtectedInvoiceAmounts(data) ? ISSUED_INVOICE_PROTECTED : null;
}
