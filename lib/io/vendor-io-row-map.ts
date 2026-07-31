import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import { resolveVendorIoPaymentSchedule } from "@/lib/io/vendor-io-payment-terms";
import { formatPaymentTermsLabel } from "@/lib/vendors/format-utils";
import type { VendorIoRow } from "@/lib/domains/io/types";
import type { PaymentTerms } from "@/types/database";

type VendorIoQueryRow = {
  id: string;
  document_number: string | null;
  assignment_id: string;
  campaign_header_id: string;
  influencer_id: string;
  amount: number;
  currency_code: string;
  status: VendorIoRow["status"];
  delivery_method?: string | null;
  delivery_status?: string | null;
  delivery_error?: string | null;
  delivered_at?: string | null;
  delivery_recipient?: string | null;
  special_payment_terms?: string | null;
  terms_html: string | null;
  terms_text: string | null;
  usage_rights: string | null;
  exclusivity: string | null;
  attachment_url: string | null;
  generated_html_url: string | null;
  generated_pdf_url: string | null;
  document_generated_at: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  campaign: { document_number: string; name: string } | null;
  influencer:
    | {
        display_name: string;
        email?: string | null;
        payment_terms?: PaymentTerms | string | null;
        vendor_io_terms_text?: string | null;
      }
    | Array<{
        display_name: string;
        email?: string | null;
        payment_terms?: PaymentTerms | string | null;
        vendor_io_terms_text?: string | null;
      }>
    | null;
  assignment:
    | { line: { document_number: string } | { document_number: string }[] | null }
    | Array<{ line: { document_number: string } | { document_number: string }[] | null }>
    | null;
};

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeDeliveryMethod(
  value: string | null | undefined
): VendorIoRow["delivery_method"] {
  if (value === "email" || value === "manual") return value;
  return null;
}

function normalizeDeliveryStatus(
  value: string | null | undefined
): VendorIoRow["delivery_status"] {
  if (value === "sent" || value === "failed" || value === "completed") return value;
  return null;
}

export function mapVendorIoQueryRow(row: VendorIoQueryRow): VendorIoRow {
  const influencer = unwrap(row.influencer);
  const assignment = unwrap(row.assignment);
  const line = unwrap(assignment?.line ?? null);
  const vendorPaymentTerms = (influencer?.payment_terms as PaymentTerms | null) ?? null;
  const vendorPaymentTermsLabel = formatPaymentTermsLabel(vendorPaymentTerms);
  const specialPaymentTerms = row.special_payment_terms ?? null;
  const effectivePaymentTermsLabel = resolveVendorIoPaymentSchedule({
    specialPaymentTerms,
    vendorPaymentTerms,
  });

  return {
    id: row.id,
    document_number: row.document_number
      ? formatDocumentNumberForDisplay(row.document_number)
      : row.document_number,
    assignment_id: row.assignment_id,
    campaign_header_id: row.campaign_header_id,
    campaign_name: row.campaign?.name ?? "—",
    campaign_document_number: row.campaign?.document_number ?? "—",
    assignment_document_number: line?.document_number ?? null,
    influencer_id: row.influencer_id,
    influencer_name: influencer?.display_name ?? "—",
    influencer_email: influencer?.email?.trim() || null,
    creator_avatar_url: null,
    vendor_io_terms_text: influencer?.vendor_io_terms_text ?? null,
    amount: Number(row.amount),
    currency_code: row.currency_code,
    status: row.status,
    delivery_method: normalizeDeliveryMethod(row.delivery_method),
    delivery_status: normalizeDeliveryStatus(row.delivery_status),
    delivery_error: row.delivery_error ?? null,
    delivered_at: row.delivered_at ?? null,
    delivery_recipient: row.delivery_recipient?.trim() || null,
    terms_html: row.terms_html,
    terms_text: row.terms_text,
    usage_rights: row.usage_rights,
    exclusivity: row.exclusivity,
    attachment_url: row.attachment_url,
    generated_html_url: row.generated_html_url,
    generated_pdf_url: row.generated_pdf_url,
    document_generated_at: row.document_generated_at,
    sent_at: row.sent_at,
    approved_at: row.approved_at,
    approved_by_name: row.approved_by_name,
    rejection_reason: row.rejection_reason,
    vendor_payment_terms: vendorPaymentTerms,
    vendor_payment_terms_label: vendorPaymentTermsLabel,
    special_payment_terms: specialPaymentTerms,
    effective_payment_terms_label: effectivePaymentTermsLabel,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    ungenerate_eligible: false,
    ungenerate_ineligible_reason: null,
  };
}
