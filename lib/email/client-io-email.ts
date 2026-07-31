import type { ClientIoRow } from "@/lib/domains/io/types";
import type { EmailAttachment } from "@/lib/email/provider";
import {
  appendThinkwayEmailPlainTextFooter,
  renderEmailApprovalCta,
  renderEmailSummaryTable,
  wrapThinkwayEmailDocument,
} from "@/lib/email/layout";
import {
  formatIoAgreedAmount,
  formatIoCampaignDuration,
} from "@/lib/email/io-email-summary";
import { getEmailFromAddress } from "@/lib/email/provider";

export type ClientIoEmailSummaryFields = {
  campaign_name: string;
  brand_name: string | null;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
  agreed_amount?: number | null;
  currency_code?: string | null;
  document_number?: string | null;
};

export type ClientIoEmailPreview = {
  subject: string;
  fromEmail: string;
  fromName: string;
  html: string;
  plainText: string;
  hasPdfAttachment: boolean;
};

export function buildClientIoEmailSubject(
  io: Pick<ClientIoRow, "document_number" | "campaign_name">
): string {
  const doc = io.document_number ?? "CIO";
  return `Client Insertion Order — ${doc} — ${io.campaign_name}`;
}

function summaryRows(io: ClientIoEmailSummaryFields) {
  return [
    { label: "Campaign Name", value: io.campaign_name?.trim() || "—" },
    { label: "Brand Name", value: io.brand_name?.trim() || "—" },
    {
      label: "Campaign Duration",
      value: formatIoCampaignDuration(io.campaign_start_date, io.campaign_end_date),
    },
    {
      label: "Agreed Amount",
      value: formatIoAgreedAmount(io.agreed_amount, io.currency_code),
    },
  ];
}

export function buildClientIoEmailPlainText(input: {
  io: ClientIoEmailSummaryFields;
  senderName: string | null;
  approvalUrl?: string | null;
  includeAcknowledgmentNote?: boolean;
}): string {
  const rows = summaryRows(input.io);
  return appendThinkwayEmailPlainTextFooter([
    "Hello,",
    "",
    "Please find attached the Client Insertion Order for your review and approval.",
    "The attached PDF is the official document.",
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    input.approvalUrl
      ? `Approve Client IO: ${input.approvalUrl}`
      : input.includeAcknowledgmentNote
        ? "An approval link will be included when the IO is sent."
        : null,
  ]);
}

export function buildClientIoEmailPreview(input: {
  io: Pick<ClientIoRow, "document_number" | "campaign_name" | "brand_name" | "generated_pdf_url"> &
    Partial<ClientIoEmailSummaryFields>;
  senderName: string | null;
  approvalUrl?: string | null;
  isDraftPreview?: boolean;
}): ClientIoEmailPreview {
  const subject = buildClientIoEmailSubject(input.io);
  const fromEmail = getEmailFromAddress();
  const fromName = input.senderName?.trim() || "Thinkway";
  const summary: ClientIoEmailSummaryFields = {
    campaign_name: input.io.campaign_name,
    brand_name: input.io.brand_name,
    campaign_start_date: input.io.campaign_start_date ?? null,
    campaign_end_date: input.io.campaign_end_date ?? null,
    agreed_amount: input.io.agreed_amount ?? null,
    currency_code: input.io.currency_code ?? null,
    document_number: input.io.document_number,
  };

  return {
    subject,
    fromEmail,
    fromName,
    html: buildClientIoEmailHtml({
      io: summary,
      senderName: input.senderName,
      approvalUrl: input.approvalUrl ?? null,
    }),
    plainText: buildClientIoEmailPlainText({
      io: summary,
      senderName: input.senderName,
      approvalUrl: input.approvalUrl ?? null,
      includeAcknowledgmentNote: Boolean(input.isDraftPreview && !input.approvalUrl),
    }),
    hasPdfAttachment: Boolean(input.io.generated_pdf_url),
  };
}

export function buildClientIoEmailHtml(input: {
  io: ClientIoEmailSummaryFields;
  senderName: string | null;
  approvalUrl?: string | null;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hello,</p>
    <p style="margin:0 0 20px;">
      Please find attached the <strong>Client Insertion Order</strong> for your review and approval.
      The attached PDF is the official document.
    </p>
    ${renderEmailSummaryTable(summaryRows(input.io))}
    ${
      input.approvalUrl
        ? renderEmailApprovalCta(input.approvalUrl, "Approve Client IO")
        : ""
    }
  `;

  return wrapThinkwayEmailDocument({
    documentTitle: "Client Insertion Order",
    documentKind: "Client Insertion Order notification",
    bodyHtml,
  });
}

export function buildClientIoPdfAttachmentFromBuffer(
  buffer: Buffer | null
): EmailAttachment | null {
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
): Promise<EmailAttachment | null> {
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
