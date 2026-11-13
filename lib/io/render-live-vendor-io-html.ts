import type { SupabaseClient } from "@supabase/supabase-js";

import { loadVendorIoDocumentData } from "@/lib/io/vendor-io-document-data";
import { renderVendorIoHtml } from "@/lib/io/vendor-io-template-render";

/** Always renders from current platform data (vendor bank details, deliverables, etc.). */
export async function renderLiveVendorIoHtml(
  supabase: SupabaseClient,
  vendorIoId: string
): Promise<string> {
  const { data: signed, error } = await supabase.from("vendor_io_signatures")
    .select("signed_html").eq("vendor_io_id", vendorIoId).maybeSingle();
  if (error) throw new Error("Could not verify the signed IO document. Please try again.");
  if (signed) return signed.signed_html;
  const data = await loadVendorIoDocumentData(supabase, vendorIoId);
  return renderVendorIoHtml(data);
}
