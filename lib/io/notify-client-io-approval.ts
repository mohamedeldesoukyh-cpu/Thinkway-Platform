import type { SupabaseClient } from "@supabase/supabase-js";
import { sendIoApprovalConfirmationEmails } from "@/lib/email/io-approval-emails";
import { prepareClientIoEmailAttachment } from "@/lib/io/client-io-email-attachment";

/** Called only after the approval RPC has authorized and recorded the decision. */
export async function notifyClientIoApproval(
  db: SupabaseClient,
  ioId: string,
  approverEmail: string | null,
  approverName: string | null,
) {
  const { data: io, error } = await db.from("client_ios")
    .select("id, status, campaign_header_id, document_number, approved_at, generated_pdf_url, terms_html")
    .eq("id", ioId).single();
  if (error) throw new Error(error.message);
  if (io.status !== "approved" || !io.approved_at) throw new Error("IO approval has not been recorded.");

  const { data: campaign } = await db.from("campaign_headers")
    .select("name, accepted_quotation_id, quotation_id").eq("id", io.campaign_header_id).maybeSingle();
  const quotationId = campaign?.accepted_quotation_id || campaign?.quotation_id;
  let quotationNumber: string | null = null;
  if (quotationId) {
    const { data: quotation } = await db.from("quotations").select("serial_number, version_number").eq("id", quotationId).maybeSingle();
    if (quotation?.serial_number) quotationNumber = /-V\d+$/i.test(quotation.serial_number)
      ? quotation.serial_number : quotation.serial_number + (quotation.version_number ? "-V" + quotation.version_number : "");
  }
  let attachment = null;
  try {
    const prepared = await prepareClientIoEmailAttachment(db, io, io.approved_at);
    if (prepared.ok) attachment = prepared.attachment;
    else console.error("Approved Client IO PDF unavailable", prepared.error);
  } catch (error) { console.error("Approved Client IO PDF unavailable", error); }
  return sendIoApprovalConfirmationEmails({
    supabase: db, kind: "client", ioId: io.id, documentNumber: io.document_number,
    quotationNumber, campaignName: campaign?.name ?? null, approvedAt: io.approved_at,
    approvedByEmail: approverEmail, approvedByName: approverName, pdfAttachment: attachment,
  });
}
