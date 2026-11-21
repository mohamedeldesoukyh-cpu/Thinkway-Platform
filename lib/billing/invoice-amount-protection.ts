import type { SupabaseClient } from "@supabase/supabase-js";

export const ISSUED_INVOICE_PROTECTED = "Issued invoice amounts cannot be changed. Unpost its Accounting journal before correcting it, or use a credit/debit note.";

export function hasProtectedInvoiceAmounts(invoice: {
  status?: string | null;
  issue_date?: string | null;
  amounts_finalized_at?: string | null;
}): boolean {
  return Boolean(invoice.amounts_finalized_at || invoice.issue_date || (invoice.status && invoice.status !== "draft"));
}

export async function isAccountingCorrectionAllowed(db:SupabaseClient,invoiceId:string):Promise<boolean>{
 const {data,error}=await db.rpc('tw_accounting_invoice_correction_allowed',{p_invoice:invoiceId});
 return !error&&data===true;
}

/** Fail closed before any mutation, including operational unlinking. */
export async function invoiceAmountMutationError(db: SupabaseClient, invoiceId: string): Promise<string | null> {
  const { data, error } = await db.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (error || !data) return "Unable to verify invoice protection. No changes were made.";
  if(!hasProtectedInvoiceAmounts(data))return null;
  return await isAccountingCorrectionAllowed(db,invoiceId)?null:ISSUED_INVOICE_PROTECTED;
}
