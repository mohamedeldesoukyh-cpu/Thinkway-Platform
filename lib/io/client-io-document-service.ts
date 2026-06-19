import type { SupabaseClient } from "@supabase/supabase-js";

import { buildIoDocumentStoragePath } from "@/lib/io/io-document-storage";
import { loadClientIoDocumentData } from "@/lib/io/client-io-document-data";
import { renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import { renderClientIoHtml } from "@/lib/io/client-io-template-render";
import type { ClientIoDocumentLayout } from "@/lib/io/client-io-document-layout";

export const CLIENT_IO_DOCUMENTS_BUCKET = "client-io-documents";

export type ClientIoDocumentResult = {
  clientIoId: string;
  documentNumber: string;
  html: string;
  htmlUrl: string | null;
  pdfUrl: string | null;
  generatedAt: string;
};

async function uploadDocument(
  supabase: SupabaseClient,
  clientIoId: string,
  fileName: string,
  body: Buffer | string,
  contentType: string
): Promise<string> {
  const path = buildIoDocumentStoragePath(clientIoId, fileName);
  const payload = typeof body === "string" ? Buffer.from(body, "utf8") : body;

  const { error } = await supabase.storage.from(CLIENT_IO_DOCUMENTS_BUCKET).upload(path, payload, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return path;
}

export async function generateClientIoDocument(
  supabase: SupabaseClient,
  clientIoId: string,
  actorId?: string,
  layout: ClientIoDocumentLayout = "detailed"
): Promise<ClientIoDocumentResult> {
  const { data: existing } = await supabase
    .from("client_ios")
    .select("document_number")
    .eq("id", clientIoId)
    .maybeSingle();

  if (existing && !(existing as { document_number: string | null }).document_number) {
    await supabase
      .from("client_ios")
      .update({ updated_by: actorId ?? null } as never)
      .eq("id", clientIoId);
  }

  const data = await loadClientIoDocumentData(supabase, clientIoId, actorId);
  const html = renderClientIoHtml(data, layout);
  const generatedAt = new Date().toISOString();

  let htmlUrl: string | null = null;
  let pdfUrl: string | null = null;

  try {
    htmlUrl = await uploadDocument(
      supabase,
      clientIoId,
      "document.html",
      html,
      "text/html; charset=utf-8"
    );
  } catch (error) {
    console.warn("[client-io-document] HTML storage failed", error);
  }

  const pdfResult = await renderHtmlToPdf(html);
  if (pdfResult.ok) {
    try {
      pdfUrl = await uploadDocument(
        supabase,
        clientIoId,
        "document.pdf",
        pdfResult.buffer,
        "application/pdf"
      );
    } catch (error) {
      console.warn("[client-io-document] PDF storage failed", error);
    }
  }

  const { error: updateError } = await supabase
    .from("client_ios")
    .update({
      terms_html: html,
      generated_html_url: htmlUrl,
      generated_pdf_url: pdfUrl,
      document_generated_at: generatedAt,
      status: "generated",
      updated_by: actorId ?? null,
    } as never)
    .eq("id", clientIoId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    clientIoId,
    documentNumber: data.documentNumber,
    html,
    htmlUrl,
    pdfUrl,
    generatedAt,
  };
}
