import {
  appendThinkwayEmailPlainTextFooter,
  escapeEmailHtml,
  renderEmailSummaryTable,
  wrapThinkwayEmailDocument,
} from "@/lib/email/layout";
import { getEmailFromAddress, sendEmail } from "@/lib/email/provider";
import type { EmailAttachment } from "@/lib/email/provider";
import { buildIoDeliveryNotificationMeta } from "@/lib/email/delivery-notification";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TRAFFIC_OPERATIONS_EMAIL = "traffic@thinkwaymedia.com";

export type IoApprovalEmailKind = "client" | "vendor";

function formatApprovalWhen(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function buildIoApprovalConfirmationSubject(input: {
  kind: IoApprovalEmailKind;
  documentNumber: string | null;
  quotationNumber?: string | null;
}): string {
  if (input.kind === "client" && input.quotationNumber?.trim()) {
    return `Approved quotation ${input.quotationNumber.trim()} – ${input.documentNumber ?? "Client IO"} – Thinkway Media`;
  }
  const doc = input.documentNumber?.trim() || (input.kind === "client" ? "CIO" : "VIO");
  const label = input.kind === "client" ? "Client IO" : "Creator IO";
  return `${label} ${doc} – Approval Confirmed – Thinkway Media`;
}

export function buildIoApprovalConfirmationHtml(input: {
  kind: IoApprovalEmailKind;
  documentNumber: string | null;
  quotationNumber?: string | null;
  approvedAt: string | null;
  recipientName?: string | null;
}): string {
  const label = input.kind === "client" ? "Client Insertion Order" : "Creator Insertion Order";
  const doc = input.documentNumber?.trim() || label;
  const greeting = input.recipientName?.trim()
    ? `Hello ${escapeEmailHtml(input.recipientName.trim())},`
    : "Hello,";

  const bodyHtml = `
    <p style="margin:0 0 16px;">${greeting}</p>
    <p style="margin:0 0 20px;">
      Thank you. Your approval of the attached <strong>${escapeEmailHtml(label)}</strong> has been recorded successfully.
    </p>
    ${renderEmailSummaryTable([
      { label: "Document Reference", value: doc },
      { label: "Approval Date & Time", value: formatApprovalWhen(input.approvedAt) },
    ])}
    <p style="margin:0 0 20px;font-size:14px;color:#374151;">
      A PDF copy of the approved document is attached for your records.
    </p>
  `;

  return wrapThinkwayEmailDocument({
    documentTitle: "Approval Confirmed",
    documentKind: `${label} approval confirmation`,
    bodyHtml,
  });
}

export function buildIoApprovalConfirmationPlainText(input: {
  kind: IoApprovalEmailKind;
  documentNumber: string | null;
  quotationNumber?: string | null;
  approvedAt: string | null;
  recipientName?: string | null;
}): string {
  const label = input.kind === "client" ? "Client Insertion Order" : "Creator Insertion Order";
  const doc = input.documentNumber?.trim() || label;
  return appendThinkwayEmailPlainTextFooter([
    input.recipientName?.trim() ? `Hello ${input.recipientName.trim()},` : "Hello,",
    "",
    `Thank you. Your approval of the attached ${label} has been recorded successfully.`,
    "",
    `Document Reference: ${doc}`,
    `Approval Date & Time: ${formatApprovalWhen(input.approvedAt)}`,
    "",
    "A PDF copy of the approved document is attached for your records.",
  ]);
}

export function buildIoApprovalInternalHtml(input: {
  kind: IoApprovalEmailKind;
  documentNumber: string | null;
  quotationNumber?: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  campaignName: string | null;
}): string {
  const label = input.kind === "client" ? "Client IO" : "Creator IO";
  const doc = input.documentNumber?.trim() || label;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hello Traffic Operations,</p>
    <p style="margin:0 0 20px;">
      A <strong>${escapeEmailHtml(label)}</strong> has been approved.
    </p>
    ${renderEmailSummaryTable([
      { label: "Document", value: doc },
      { label: "Campaign", value: input.campaignName?.trim() || "—" },
      { label: "Approved By", value: input.approvedByEmail?.trim() || "—" },
      { label: "Approval Date & Time", value: formatApprovalWhen(input.approvedAt) },
    ])}
  `;

  return wrapThinkwayEmailDocument({
    documentTitle: `${label} Approved`,
    documentKind: `${label} internal approval notification`,
    bodyHtml,
  });
}

export async function sendIoApprovalConfirmationEmails(input: {
  supabase: SupabaseClient;
  kind: IoApprovalEmailKind;
  ioId: string;
  documentNumber: string | null;
  quotationNumber?: string | null;
  campaignName: string | null;
  approvedAt: string | null;
  approvedByEmail: string | null;
  approvedByName?: string | null;
  pdfAttachment: EmailAttachment | null;
}, deliver: typeof sendEmail = sendEmail): Promise<{ approverSent: boolean; internalSent: boolean }> {
  const subject = buildIoApprovalConfirmationSubject(input);
  const attachments = input.pdfAttachment ? [input.pdfAttachment] : undefined;
  async function sendAndRecord(email: string, name: string | null, internal: boolean): Promise<boolean> {
    const sentAt = new Date().toISOString();
    const recipient = { ...input, recipientName: input.approvedByName };
    const html = internal ? buildIoApprovalInternalHtml(input) : buildIoApprovalConfirmationHtml(recipient);
    const text = internal ? appendThinkwayEmailPlainTextFooter([
      "Hello Traffic Operations,",
      `Document: ${input.documentNumber ?? "—"}`,
      `Campaign: ${input.campaignName ?? "—"}`,
      `Approved By: ${input.approvedByEmail ?? input.approvedByName ?? "—"}`,
      `Approval Date & Time: ${formatApprovalWhen(input.approvedAt)}`,
      input.pdfAttachment ? "The approved IO is attached." : "The IO is approved. Its PDF could not be prepared; open the campaign to retrieve it.",
    ]) : buildIoApprovalConfirmationPlainText(recipient);
    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      result = await deliver({ to: [{ email, name: name ?? undefined }], subject, html, text, attachments });
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : "Email delivery failed." };
    }
    try {
      const log = await input.supabase.from("io_notifications").insert({
        io_type: input.kind, io_id: input.ioId,
        event_type: input.kind === "client" ? "client_io_approved" : "vendor_io_approved",
        recipient_email: email, recipient_name: name, sender_email: getEmailFromAddress(), subject,
        gmail_message_id: result.ok ? result.messageId : null,
        delivery_status: result.ok ? "sent" : "failed", delivery_error: result.ok ? null : result.error,
        payload: {
          notification_kind: internal ? "approval_confirmation_internal" : "approval_confirmation_approver",
          document_number: input.documentNumber,
          approved_at: input.approvedAt,
          attachment_included: Boolean(input.pdfAttachment),
          ...buildIoDeliveryNotificationMeta({ deliveryMethod: "email", deliveryStatus: result.ok ? "sent" : "failed", recipient: email, subject, messageId: result.ok ? result.messageId : null, sentAt }),
        }, sent_at: sentAt,
      } as never);
      if (log.error) console.error("IO approval notification log failed", log.error.message);
    } catch (error) { console.error("IO approval notification log failed", error); }
    return result.ok;
  }
  // Deliver independently so a missing approver or failed delivery cannot suppress Traffic.
  const [internalSent, approverSent] = await Promise.all([
    sendAndRecord(TRAFFIC_OPERATIONS_EMAIL, "Traffic Operations", true),
    input.approvedByEmail && input.pdfAttachment
      ? sendAndRecord(input.approvedByEmail, input.approvedByName ?? null, false)
      : Promise.resolve(false),
  ]);
  return { approverSent, internalSent };
}
