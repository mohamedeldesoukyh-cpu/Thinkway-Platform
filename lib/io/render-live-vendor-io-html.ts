import type { SupabaseClient } from "@supabase/supabase-js";

import { loadVendorIoDocumentData } from "@/lib/io/vendor-io-document-data";
import { renderVendorIoHtml } from "@/lib/io/vendor-io-template-render";

/** Always renders from current platform data (vendor bank details, deliverables, etc.). */
export async function renderLiveVendorIoHtml(
  supabase: SupabaseClient,
  vendorIoId: string
): Promise<string> {
  const data = await loadVendorIoDocumentData(supabase, vendorIoId);
  return renderVendorIoHtml(data);
}
