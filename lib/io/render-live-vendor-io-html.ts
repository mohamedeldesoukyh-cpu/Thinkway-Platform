import type { SupabaseClient } from "@supabase/supabase-js";

import { loadVendorIoDocumentData } from "@/lib/io/vendor-io-document-data";
import { renderVendorIoHtml } from "@/lib/io/vendor-io-template-render";

/** Preview delivered snapshots; explicit sends may prepare current data. Signed IOs are immutable. */
export async function renderLiveVendorIoHtml(
  supabase: SupabaseClient,
  vendorIoId: string,
  options: { prepareCurrent?: boolean } = {}
): Promise<string> {
  const { data: signed, error } = await supabase.from("vendor_io_signatures")
    .select("signed_html").eq("vendor_io_id", vendorIoId).maybeSingle();
  if (error) throw new Error("Could not verify the signed IO document. Please try again.");
  if (signed) return signed.signed_html;
  if (!options.prepareCurrent) {
    const { data: delivered, error: snapshotError } = await supabase.from("vendor_ios")
      .select("signing_document_html, terms_html, sent_at, delivered_at, approved_at")
      .eq("id", vendorIoId).maybeSingle();
    if (snapshotError) throw new Error("Could not verify the delivered IO document. Please try again.");
    if (delivered && (delivered.sent_at || delivered.delivered_at || delivered.approved_at)) {
      const snapshot = delivered.signing_document_html || delivered.terms_html;
      if (snapshot) return snapshot;
      throw new Error("The original delivered IO is unavailable. Please open its saved attachment.");
    }
  }
  const data = await loadVendorIoDocumentData(supabase, vendorIoId);
  return renderVendorIoHtml(data);
}
