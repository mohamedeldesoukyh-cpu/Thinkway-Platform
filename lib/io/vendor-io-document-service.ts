import type { SupabaseClient } from "@supabase/supabase-js";

import { loadVendorIoDocumentData } from "@/lib/io/vendor-io-document-data";
import { renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { renderVendorIoHtml } from "@/lib/io/vendor-io-template-render";

export const VENDOR_IO_DOCUMENTS_BUCKET = "vendor-io-documents";

export type VendorIoDocumentResult = {
  vendorIoId: string;
  documentNumber: string;
  html: string;
  htmlUrl: string | null;
  pdfUrl: string | null;
  generatedAt: string;
};

async function uploadDocument(
  supabase: SupabaseClient,
  vendorIoId: string,
  fileName: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  const path = `${vendorIoId}/${fileName}`;
  const payload = typeof body === "string" ? Buffer.from(body, "utf8") : body;

  const { error } = await supabase.storage.from(VENDOR_IO_DOCUMENTS_BUCKET).upload(path, payload, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(VENDOR_IO_DOCUMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function generateVendorIoDocument(
  supabase: SupabaseClient,
  vendorIoId: string,
  actorId?: string
): Promise<VendorIoDocumentResult> {
  const data = await loadVendorIoDocumentData(supabase, vendorIoId);
  const html = renderVendorIoHtml(data);
  const generatedAt = new Date().toISOString();

  let htmlUrl: string | null = null;
  let pdfUrl: string | null = null;

  try {
    htmlUrl = await uploadDocument(supabase, vendorIoId, "document.html", html, "text/html; charset=utf-8");
  } catch (error) {
    console.warn("[vendor-io-document] HTML storage failed", error);
  }

  const pdfBuffer = await renderHtmlToPdf(html);
  if (pdfBuffer) {
    try {
      pdfUrl = await uploadDocument(supabase, vendorIoId, "document.pdf", pdfBuffer, "application/pdf");
    } catch (error) {
      console.warn("[vendor-io-document] PDF storage failed", error);
    }
  }

  const { error: updateError } = await supabase
    .from("vendor_ios")
    .update({
      terms_html: html,
      generated_html_url: htmlUrl,
      generated_pdf_url: pdfUrl,
      document_generated_at: generatedAt,
      status: "generated",
      updated_by: actorId ?? null,
    } as never)
    .eq("id", vendorIoId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    vendorIoId,
    documentNumber: data.documentNumber,
    html,
    htmlUrl,
    pdfUrl,
    generatedAt,
  };
}
