import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmailAttachment } from "@/lib/email/provider";
import { downloadIoDocumentBuffer } from "@/lib/io/io-document-storage";
import { INSERTION_ORDER_PDF_OPTIONS, renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";

export function approvedClientIoHtml(html: string, approvedAt: string): string {
  const date = new Date(approvedAt);
  if (Number.isNaN(date.getTime())) throw new Error("The recorded approval date is unavailable.");
  const display = date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    timeZone: "Africa/Cairo", timeZoneName: "short",
  });
  const banner = `<div data-io-approval="approved" style="break-inside:avoid;margin:0 0 16px;padding:14px 18px;border:2px solid #047857;background:#ecfdf5;color:#065f46;font-family:Arial,sans-serif;font-size:14px;line-height:1.5"><strong style="font-size:18px">Approved</strong><br>Approval date: ${display} (Cairo)</div>`;
  return /<body\b[^>]*>/i.test(html) ? html.replace(/<body\b[^>]*>/i, body => body + banner) : banner + html;
}

/** Use the saved document, never rebuild an issued IO from live campaign values. */
export async function prepareClientIoEmailAttachment(
  supabase: SupabaseClient,
  io: { document_number: string | null; generated_pdf_url: string | null; terms_html: string | null },
  approvedAt?: string,
  render: typeof renderHtmlToPdf = renderHtmlToPdf
): Promise<{ ok: true; attachment: EmailAttachment } | { ok: false; error: string }> {
  try {
    let buffer = approvedAt ? null : await downloadIoDocumentBuffer(supabase, "client-io-documents", io.generated_pdf_url);
    if (!buffer?.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      if (!io.terms_html?.trim()) return { ok: false, error: "The saved Client IO document is unavailable. Regenerate it or create an amendment before sending." };
      const html = approvedAt ? approvedClientIoHtml(io.terms_html, approvedAt) : io.terms_html;
      const result = await render(html, INSERTION_ORDER_PDF_OPTIONS);
      if (!result.ok) return { ok: false, error: "Could not create the Client IO PDF attachment. Please retry. " + result.error };
      buffer = result.buffer;
    }
    if (!buffer?.subarray(0, 5).equals(Buffer.from("%PDF-"))) return { ok: false, error: "The Client IO PDF attachment is invalid. Nothing was sent." };
    const reference = (io.document_number || "Client-IO").replace(/[^a-zA-Z0-9_-]/g, "-");
    return { ok: true, attachment: { filename: `${reference}${approvedAt ? "-Approved" : ""}.pdf`, mimeType: "application/pdf", content: buffer } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not prepare the Client IO PDF attachment." };
  }
}
