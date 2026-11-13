"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { loadVendorSigningSession } from "@/lib/io/vendor-io-signing-session";
import { signingInputSchema, signatureSvg, signedVendorIoHtml } from "@/lib/io/vendor-io-signature";
import { renderHtmlToPdf, INSERTION_ORDER_PDF_OPTIONS } from "@/lib/io/vendor-io-pdf";
import { createIoDocumentSignedUrl } from "@/lib/io/io-document-storage";
import { sendIoApprovalConfirmationEmails } from "@/lib/email/io-approval-emails";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export async function signVendorIoAction(input: unknown): Promise<{
  ok: boolean; message: string; downloadUrl?: string | null;
}> {
  const parsed = signingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Enter your name and draw your signature." };
  let committed = false;
  try {
    const session = await loadVendorSigningSession(parsed.data);
    const { db, io } = session;
    if (session.alreadyApproved) return { ok: true, message: "This IO has already been approved.",
      downloadUrl: session.signature ? await createIoDocumentSignedUrl(db, "vendor-io-documents", session.signature.signed_pdf_path) : null };
    if (session.documentHash !== parsed.data.documentHash) return { ok: false, message: "This IO has changed. Reload the page and review it before signing." };
    if (!consumeRateLimit({ category: "export", identity: `io-sign:${io.id}` }).allowed) return { ok: false, message: "Please wait a minute before trying again." };
    const h = await headers();
    const signedAt = new Date().toISOString();
    const signedHtml = signedVendorIoHtml({ html: io.terms_html!, name: parsed.data.name, signedAt,
      documentHash: session.documentHash!, signatureDataUrl: `data:image/svg+xml;base64,${Buffer.from(signatureSvg(parsed.data.strokes)).toString("base64")}` });
    const pdf = await renderHtmlToPdf(signedHtml, INSERTION_ORDER_PDF_OPTIONS);
    if (!pdf.ok || !pdf.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) return { ok: false, message: "We couldn’t prepare your signed PDF. Your IO has not been approved. Please try again." };
    const path = `${io.id}/signed/${randomUUID()}.pdf`;
    const upload = await db.storage.from("vendor-io-documents").upload(path, pdf.buffer, { contentType: "application/pdf", upsert: false });
    if (upload.error) return { ok: false, message: "We couldn’t save your signed PDF. Please try again." };
    const { data, error } = await db.rpc("sign_vendor_io", {
      p_io_id: io.id, p_token: session.token ?? null, p_actor_id: session.actorId,
      p_name: parsed.data.name, p_strokes: parsed.data.strokes, p_document_hash: session.documentHash,
      p_signed_html: signedHtml, p_pdf_path: path, p_signed_at: signedAt,
      p_ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, p_user_agent: h.get("user-agent"),
    });
    if (error) {
      // A transport error may arrive after the transaction committed. Never delete
      // a PDF that might already be the permanent signing record.
      const check = await db.from("vendor_io_signatures").select("signed_pdf_path").eq("vendor_io_id",io.id).maybeSingle();
      if (check.data?.signed_pdf_path === path) {
        committed = true;
        return { ok: true, message: "Signed & approved. Download your signed copy below.", downloadUrl: await createIoDocumentSignedUrl(db,"vendor-io-documents",path) };
      }
      if (!check.error) await db.storage.from("vendor-io-documents").remove([path]);
      return { ok: false, message: error.message.includes("DOCUMENT_CHANGED") ? "This IO changed while you were signing. Reload and review it before signing again." : "This signing link is no longer available. Please ask Thinkway for a new link." };
    }
    committed = true;
    if (data?.already_approved) {
      await db.storage.from("vendor-io-documents").remove([path]);
      const current = await loadVendorSigningSession(parsed.data);
      return { ok: true, message: "Signed & approved. Thank you!", downloadUrl: current.signature ? await createIoDocumentSignedUrl(db,"vendor-io-documents",current.signature.signed_pdf_path) : null };
    }
    const creator = Array.isArray(io.influencers) ? io.influencers[0] : io.influencers;
    const campaign = Array.isArray(io.campaign) ? io.campaign[0] : io.campaign;
    const recipient = io.delivery_recipient && io.delivery_recipient !== "Manual" ? io.delivery_recipient : creator?.email;
    let emailed = false;
    try {
      const result = await sendIoApprovalConfirmationEmails({ supabase: db, kind: "vendor", ioId: io.id,
        documentNumber: io.document_number, campaignName: campaign?.name ?? null, approvedAt: signedAt,
        approvedByName: parsed.data.name, approvedByEmail: recipient ?? null,
        pdfAttachment: { filename: `${(io.document_number ?? "Creator-IO").replace(/[^\w-]/g,"-")}-Signed.pdf`, mimeType: "application/pdf", content: pdf.buffer } });
      emailed = result.approverSent;
    } catch { /* The durable signature remains approved if email delivery needs retry. */ }
    try { await syncCampaignHeaderStatus(db, io.campaign_header_id); } catch { /* Non-blocking. */ }
    revalidatePath("/campaigns", "layout");
    revalidatePath("/creator-portal", "layout");
    revalidatePath("/ios/vendor");
    return { ok: true, message: emailed ? "Signed & approved. Your signed copy has been emailed to you." : "Signed & approved. Your email copy could not be delivered; download your signed copy below.",
      downloadUrl: await createIoDocumentSignedUrl(db,"vendor-io-documents",path) };
  } catch {
    return committed ? { ok: true, message: "Signed & approved. Reload this page to download your signed copy." }
      : { ok: false, message: "We couldn’t complete signing. Your signature is still here; please try again." };
  }
}
