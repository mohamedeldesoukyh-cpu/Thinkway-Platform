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
}): string {
  const doc = input.documentNumber?.trim() || (input.kind === "client" ? "CIO" : "VIO");
  const label = input.kind === "client" ? "Client IO" : "Vendor IO";
  return `${label} ${doc} – Approval Confirmed – Thinkway Media`;
}

export function buildIoApprovalConfirmationHtml(input: {
  kind: IoApprovalEmailKind;
  documentNumber: string | null;
  approvedAt: string | null;
  recipientName?: string | null;
}): string {
  const label = input.kind === "client" ? "Client Insertion Order" : "Vendor Insertion Order";
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
  approvedAt: string | null;
  recipientName?: string | null;
}): string {
  const label = input.kind === "client" ? "Client Insertion Order" : "Vendor Insertion Order";
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
  approvedAt: string | null;
  approvedByEmail: string | null;
  campaignName: string | null;
}): string {
  const label = input.kind === "client" ? "Client IO" : "Vendor IO";
  const doc = input.documentNumber?.trim() || label;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hello Traffic Operations,</p>
    <p style="margin:0 0 20px;">
      A <strong>${escapeEmailHtml(label)}</strong> has been approved via the secure email approval link.
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
  campaignName: string | null;
  approvedAt: string | null;
  approvedByEmail: string;
  approvedByName?: string | null;
  pdfAttachment: EmailAttachment | null;
}): Promise<void> {
  const subject = buildIoApprovalConfirmationSubject({
    kind: input.kind,
    documentNumber: input.documentNumber,
  });
  const html = buildIoApprovalConfirmationHtml({
    kind: input.kind,
    documentNumber: input.documentNumber,
    approvedAt: input.approvedAt,
    recipientName: input.approvedByName,
  });
  const text = buildIoApprovalConfirmationPlainText({
    kind: input.kind,
    documentNumber: input.documentNumber,
    approvedAt: input.approvedAt,
    recipientName: input.approvedByName,
  });
  const attachments = input.pdfAttachment ? [input.pdfAttachment] : undefined;
  const sentAt = new Date().toISOString();

  const approverResult = await sendEmail({
    to: [{ email: input.approvedByEmail, name: input.approvedByName ?? undefined }],
    subject,
    html,
    text,
    attachments,
  });

  const approverMeta = buildIoDeliveryNotificationMeta({
    deliveryMethod: "email",
    deliveryStatus: approverResult.ok ? "sent" : "failed",
    recipient: input.approvedByEmail,
    subject,
    messageId: approverResult.ok ? approverResult.messageId : null,
    sentAt,
  });

  await input.supabase.from("io_notifications").insert({
    io_type: input.kind,
    io_id: input.ioId,
    event_type:
      input.kind === "client" ? "client_io_approved" : "vendor_io_approved",
    recipient_email: input.approvedByEmail,
    recipient_name: input.approvedByName ?? null,
    sender_email: getEmailFromAddress(),
    subject,
    gmail_message_id: approverResult.ok ? approverResult.messageId : null,
    delivery_status: approverResult.ok ? "sent" : "failed",
    delivery_error: approverResult.ok ? null : approverResult.error,
    payload: {
      notification_kind: "approval_confirmation_approver",
      document_number: input.documentNumber,
      ...approverMeta,
    },
    sent_at: sentAt,
  } as never);

  const internalSubject = `${
    input.kind === "client" ? "Client IO" : "Vendor IO"
  } ${input.documentNumber ?? ""} – Approved – Thinkway Media`.replace(/\s+/g, " ").trim();
  const internalHtml = buildIoApprovalInternalHtml({
    kind: input.kind,
    documentNumber: input.documentNumber,
    approvedAt: input.approvedAt,
    approvedByEmail: input.approvedByEmail,
    campaignName: input.campaignName,
  });
  const internalText = appendThinkwayEmailPlainTextFooter([
    "Hello Traffic Operations,",
    "",
    `A ${input.kind === "client" ? "Client IO" : "Vendor IO"} has been approved.`,
    `Document: ${input.documentNumber ?? "—"}`,
    `Campaign: ${input.campaignName ?? "—"}`,
    `Approved By: ${input.approvedByEmail}`,
    `Approval Date & Time: ${formatApprovalWhen(input.approvedAt)}`,
  ]);

  const trafficResult = await sendEmail({
    to: [{ email: TRAFFIC_OPERATIONS_EMAIL, name: "Traffic Operations" }],
    subject: internalSubject,
    html: internalHtml,
    text: internalText,
    attachments,
  });

  const trafficMeta = buildIoDeliveryNotificationMeta({
    deliveryMethod: "email",
    deliveryStatus: trafficResult.ok ? "sent" : "failed",
    recipient: TRAFFIC_OPERATIONS_EMAIL,
    subject: internalSubject,
    messageId: trafficResult.ok ? trafficResult.messageId : null,
    sentAt,
  });

  await input.supabase.from("io_notifications").insert({
    io_type: input.kind,
    io_id: input.ioId,
    event_type:
      input.kind === "client" ? "client_io_approved" : "vendor_io_approved",
    recipient_email: TRAFFIC_OPERATIONS_EMAIL,
    recipient_name: "Traffic Operations",
    sender_email: getEmailFromAddress(),
    subject: internalSubject,
    gmail_message_id: trafficResult.ok ? trafficResult.messageId : null,
    delivery_status: trafficResult.ok ? "sent" : "failed",
    delivery_error: trafficResult.ok ? null : trafficResult.error,
    payload: {
      notification_kind: "approval_confirmation_internal",
      document_number: input.documentNumber,
      ...trafficMeta,
    },
    sent_at: sentAt,
  } as never);
}
