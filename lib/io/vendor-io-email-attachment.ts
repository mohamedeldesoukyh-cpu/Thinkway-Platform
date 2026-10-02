import { approvedClientIoHtml } from "./client-io-email-attachment";
import { renderHtmlToPdf, INSERTION_ORDER_PDF_OPTIONS } from "./vendor-io-pdf";
import type { EmailAttachment } from "@/lib/email/provider";

/** Stamp the exact HTML saved when this Creator IO was emailed, not later campaign edits. */
export async function prepareApprovedCreatorIoAttachment(
  io: { document_number: string | null; terms_html: string | null; approved_at: string | null },
  render: typeof renderHtmlToPdf = renderHtmlToPdf,
): Promise<EmailAttachment> {
  if (!io.terms_html || !io.approved_at) throw new Error("The sent Creator IO document or recorded approval date is unavailable.");
  const result = await render(approvedClientIoHtml(io.terms_html, io.approved_at), INSERTION_ORDER_PDF_OPTIONS);
  if (!result.ok || !result.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Could not prepare the approved Creator IO PDF.");
  const reference = (io.document_number || "Creator-IO").replace(/[^a-zA-Z0-9_-]/g, "-");
  return { filename: `${reference}-Approved.pdf`, mimeType: "application/pdf", content: result.buffer };
}
