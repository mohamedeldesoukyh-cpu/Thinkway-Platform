import type { EmailAttachment } from "@/lib/email/provider";
import {
  appendThinkwayEmailPlainTextFooter,
  escapeEmailHtml,
  renderEmailApprovalCta,
  renderEmailSummaryTable,
  wrapThinkwayEmailDocument,
} from "@/lib/email/layout";
import {
  formatIoAgreedAmount,
  formatIoCampaignDuration,
} from "@/lib/email/io-email-summary";

export type VendorIoEmailFields = {
  document_number: string | null;
  campaign_name: string;
  brand_name: string | null;
  influencer_name: string;
  amount: number;
  currency_code: string;
  campaign_start_date?: string | null;
  campaign_end_date?: string | null;
  /** @deprecated Kept for callers; not shown in simplified email body. */
  client_name?: string;
  /** @deprecated Kept for callers; not shown in simplified email body. */
  issue_date?: string | null;
  generated_html_url?: string | null;
  generated_pdf_url?: string | null;
};

function summaryRows(io: VendorIoEmailFields) {
  return [
    { label: "Campaign Name", value: io.campaign_name?.trim() || "—" },
    { label: "Brand Name", value: io.brand_name?.trim() || "—" },
    {
      label: "Campaign Duration",
      value: formatIoCampaignDuration(io.campaign_start_date, io.campaign_end_date),
    },
    {
      label: "Agreed Amount",
      value: formatIoAgreedAmount(io.amount, io.currency_code),
    },
  ];
}

export function buildVendorIoEmailSubject(
  io: Pick<VendorIoEmailFields, "document_number" | "campaign_name">
): string {
  const doc = io.document_number?.trim() || "VIO";
  return `Creator Insertion Order — ${doc} — ${io.campaign_name}`;
}

export function buildVendorIoEmailPlainText(input: {
  io: VendorIoEmailFields;
  senderName: string | null;
  approvalUrl?: string | null;
  hasPdfAttachment?: boolean;
}): string {
  const rows = summaryRows(input.io);

  return appendThinkwayEmailPlainTextFooter([
    `Hello ${input.io.influencer_name},`,
    "",
    "Please find attached your Creator Insertion Order for your review and approval.",
    "The attached PDF is the official document.",
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    input.approvalUrl ? `Approve Creator IO: ${input.approvalUrl}` : null,
  ]);
}

export function buildVendorIoEmailHtml(input: {
  io: VendorIoEmailFields;
  senderName: string | null;
  approvalUrl?: string | null;
  hasPdfAttachment?: boolean;
}): string {
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hello <strong>${escapeEmailHtml(input.io.influencer_name)}</strong>,</p>
    <p style="margin:0 0 20px;">
      Please find attached your <strong>Creator Insertion Order</strong> from Thinkway Media.
      The attached PDF is the official document.
    </p>
    ${renderEmailSummaryTable(summaryRows(input.io))}
    ${
      input.approvalUrl
        ? renderEmailApprovalCta(input.approvalUrl, "Approve Creator IO")
        : ""
    }
  `;

  return wrapThinkwayEmailDocument({
    documentTitle: "Creator Insertion Order",
    documentKind: "Creator Insertion Order notification",
    bodyHtml,
  });
}

export function buildVendorIoPdfAttachmentFromBuffer(
  buffer: Buffer | null
): EmailAttachment | null {
  if (!buffer?.length) return null;

  return {
    filename: "Creator-IO.pdf",
    mimeType: "application/pdf",
    content: buffer,
  };
}
