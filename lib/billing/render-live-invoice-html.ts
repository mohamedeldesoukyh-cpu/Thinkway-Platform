import type { SupabaseClient } from "@supabase/supabase-js";

import {
  applyInvoiceDocumentLayout,
  resolveInvoiceDocumentLayout,
  type InvoiceDocumentLayout,
} from "@/lib/billing/invoice-document-layout";
import { loadInvoiceDocumentData } from "@/lib/billing/invoice-document-data";
import { renderInvoiceHtml } from "@/lib/billing/invoice-template-render";

/** Always renders from current platform data (client, campaign, line items). */
export async function renderLiveInvoiceHtml(
  supabase: SupabaseClient,
  invoiceId: string,
  layout?: InvoiceDocumentLayout | string | null
): Promise<string> {
  const data = await loadInvoiceDocumentData(supabase, invoiceId);
  const resolvedLayout = resolveInvoiceDocumentLayout(layout);
  return renderInvoiceHtml(applyInvoiceDocumentLayout(data, resolvedLayout));
}
