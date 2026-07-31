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
  io: Pick<VendorIoEmailFields, "document_number">
): string {
  const doc = io.document_number?.trim() || "VIO";
  return `Vendor IO ${doc} – Approval Required – Thinkway Media`;
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
    "Please find attached your Vendor Insertion Order from Thinkway Media.",
    "The attached PDF is the official document.",
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
    "",
    input.approvalUrl ? `Approve Vendor IO: ${input.approvalUrl}` : null,
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
      Please find attached your <strong>Vendor Insertion Order</strong> from Thinkway Media.
      The attached PDF is the official document.
    </p>
    ${renderEmailSummaryTable(summaryRows(input.io))}
    ${
      input.approvalUrl
        ? renderEmailApprovalCta(input.approvalUrl, "Approve Vendor IO")
        : ""
    }
  `;

  return wrapThinkwayEmailDocument({
    documentTitle: "Vendor Insertion Order",
    documentKind: "Vendor Insertion Order notification",
    bodyHtml,
  });
}

export function buildVendorIoPdfAttachmentFromBuffer(
  buffer: Buffer | null
): EmailAttachment | null {
  if (!buffer?.length) return null;

  return {
    filename: "Vendor-IO.pdf",
    mimeType: "application/pdf",
    content: buffer,
  };
}
