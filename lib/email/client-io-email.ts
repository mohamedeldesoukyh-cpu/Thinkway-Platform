import type { ClientIoRow } from "@/features/io/types";
import { getGmailFromEmail } from "@/lib/email/gmail-config";
import type { GmailAttachment } from "@/lib/email/gmail-send";

export type ClientIoEmailPreview = {
  subject: string;
  fromEmail: string;
  fromName: string;
  html: string;
  plainText: string;
  hasPdfAttachment: boolean;
};

export function buildClientIoEmailSubject(io: Pick<ClientIoRow, "document_number" | "campaign_name">): string {
  const doc = io.document_number ?? "CIO";
  return `Client Insertion Order — ${doc} — ${io.campaign_name}`;
}

export function buildClientIoEmailPlainText(input: {
  io: Pick<
    ClientIoRow,
    "document_number" | "campaign_name" | "client_name" | "generated_html_url" | "generated_pdf_url"
  >;
  senderName: string | null;
  approvalUrl?: string | null;
  documentViewUrl?: string | null;
  includeAcknowledgmentNote?: boolean;
}): string {
  const doc = input.io.document_number ?? "Client IO";
  const sender = input.senderName?.trim() || "Thinkway";
  const fromEmail = getGmailFromEmail();
  const viewUrl =
    input.documentViewUrl ?? input.io.generated_html_url ?? input.io.generated_pdf_url;

  const lines = [
    "Hello,",
    "",
    `Please find the Client Insertion Order for ${input.io.campaign_name} (${doc}).`,
    `Client: ${input.io.client_name}`,
    viewUrl ? `View document: ${viewUrl}` : null,
    input.approvalUrl
      ? `Acknowledgment link (included when sent): ${input.approvalUrl}`
      : input.includeAcknowledgmentNote
        ? "An acknowledgment link will be included when the IO is sent."
        : null,
    "",
    `This IO is issued on a deemed-acceptance basis. If you have questions or amendments, reply to this email within three (3) business days and reference ${doc}.`,
    "",
    `Best regards,`,
    sender,
    "Thinkway",
    "",
    `Sent from ${fromEmail}`,
  ].filter((line): line is string => line != null);

  return lines.join("\n");
}

export function buildClientIoEmailPreview(input: {
  io: Pick<
    ClientIoRow,
    | "document_number"
    | "campaign_name"
    | "client_name"
    | "generated_html_url"
    | "generated_pdf_url"
  >;
  senderName: string | null;
  approvalUrl?: string | null;
  documentViewUrl?: string | null;
  isDraftPreview?: boolean;
}): ClientIoEmailPreview {
  const subject = buildClientIoEmailSubject(input.io);
  const fromEmail = getGmailFromEmail();
  const fromName = input.senderName?.trim() || "Thinkway";

  return {
    subject,
    fromEmail,
    fromName,
    html: buildClientIoEmailHtml({
      io: input.io,
      senderName: input.senderName,
      approvalUrl: input.approvalUrl ?? null,
      documentViewUrl: input.documentViewUrl ?? null,
    }),
    plainText: buildClientIoEmailPlainText({
      io: input.io,
      senderName: input.senderName,
      approvalUrl: input.approvalUrl ?? null,
      documentViewUrl: input.documentViewUrl ?? null,
      includeAcknowledgmentNote: Boolean(input.isDraftPreview && !input.approvalUrl),
    }),
    hasPdfAttachment: Boolean(input.io.generated_pdf_url),
  };
}

export function buildClientIoEmailHtml(input: {
  io: Pick<
    ClientIoRow,
    "document_number" | "campaign_name" | "client_name" | "generated_html_url" | "generated_pdf_url"
  >;
  senderName: string | null;
  approvalUrl?: string | null;
  documentViewUrl?: string | null;
}): string {
  const doc = input.io.document_number ?? "Client IO";
  const viewUrl =
    input.documentViewUrl ?? input.io.generated_html_url ?? input.io.generated_pdf_url;
  const sender = input.senderName?.trim() || "Thinkway";
  const fromEmail = getGmailFromEmail();

  return `<!DOCTYPE html>
<html>
<body style="font-family: Inter, Arial, sans-serif; color: #0A0F1E; line-height: 1.6; max-width: 640px;">
  <p>Hello,</p>
  <p>Please find the <strong>Client Insertion Order</strong> for <strong>${escapeHtml(input.io.campaign_name)}</strong> (${escapeHtml(doc)}).</p>
  <p>Client: <strong>${escapeHtml(input.io.client_name)}</strong></p>
  ${
    viewUrl
      ? `<p><a href="${escapeHtml(viewUrl)}" style="color:#0057FF;">View Client IO document</a></p>`
      : ""
  }
  ${
    input.approvalUrl
      ? `<p>If you need to acknowledge or request changes, use this link: <a href="${escapeHtml(input.approvalUrl)}" style="color:#0057FF;">Open IO acknowledgment</a></p>`
      : ""
  }
  <p>This IO is issued on a deemed-acceptance basis. If you have questions or amendments, reply to this email within three (3) business days and reference <strong>${escapeHtml(doc)}</strong>.</p>
  <p>Best regards,<br>${escapeHtml(sender)}<br>Thinkway</p>
  <p style="font-size:12px;color:#6B7280;">Sent from ${escapeHtml(fromEmail)}</p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildClientIoPdfAttachmentFromBuffer(
  buffer: Buffer | null
): GmailAttachment | null {
  if (!buffer?.length) return null;

  return {
    filename: "Client-IO.pdf",
    mimeType: "application/pdf",
    content: buffer,
  };
}

/** @deprecated Prefer buildClientIoPdfAttachmentFromBuffer with storage download. */
export async function buildClientIoPdfAttachment(
  pdfUrl: string | null
): Promise<GmailAttachment | null> {
  if (!pdfUrl?.trim()) return null;

  try {
    const response = await fetch(pdfUrl);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buildClientIoPdfAttachmentFromBuffer(buffer);
  } catch {
    return null;
  }
}
