import type { SupabaseClient } from "@supabase/supabase-js";

import { loadInvoiceDocumentData } from "@/lib/billing/invoice-document-data";
import { renderInvoiceHtml } from "@/lib/billing/invoice-template-render";

/** Always renders from current platform data (client, campaign, line items). */
export async function renderLiveInvoiceHtml(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<string> {
  const data = await loadInvoiceDocumentData(supabase, invoiceId);
  return renderInvoiceHtml(data);
}
