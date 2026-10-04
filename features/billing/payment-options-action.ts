"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadInvoicePaymentContext } from "@/lib/billing/invoice-payment-context";
export async function invoicePaymentOptionsAction(campaignId: string) {
  const db = await createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return loadInvoicePaymentContext(db, campaignId);
}
