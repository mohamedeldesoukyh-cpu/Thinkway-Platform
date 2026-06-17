export type ClientIoStatus = "draft" | "generated" | "sent" | "approved" | "cancelled";
export type VendorIoStatus = "draft" | "generated" | "sent" | "approved" | "rejected";

export type ClientIoSendRecipient = {
  id: string;
  label: string;
  email: string;
};

export type ClientIoSendHistoryEntry = {
  id: string;
  recipient_email: string | null;
  recipient_name: string | null;
  sender_email: string | null;
  subject: string | null;
  delivery_status: string | null;
  delivery_error: string | null;
  sent_at: string | null;
  created_at: string;
  sent_by_name: string | null;
  send_batch_id: string | null;
  email_html: string | null;
  email_text: string | null;
  sent_by_display_name: string | null;
};

export type ClientIoRow = {
  id: string;
  document_number: string | null;
  campaign_header_id: string;
  campaign_name: string;
  campaign_document_number: string;
  client_id: string;
  client_name: string;
  status: ClientIoStatus;
  terms_html: string | null;
  terms_text: string | null;
  billing_terms: string | null;
  attachment_url: string | null;
  generated_html_url: string | null;
  generated_pdf_url: string | null;
  document_generated_at: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  brand_name: string | null;
  client_io_terms_text: string | null;
  send_recipients: Array<{ name: string; email: string }>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorIoRow = {
  id: string;
  document_number: string | null;
  assignment_id: string;
  campaign_header_id: string;
  campaign_name: string;
  campaign_document_number: string;
  assignment_document_number: string | null;
  influencer_id: string;
  influencer_name: string;
  amount: number;
  currency_code: string;
  status: VendorIoStatus;
  ungenerate_eligible: boolean;
  ungenerate_ineligible_reason: string | null;
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
  vendor_payment_terms: string | null;
  vendor_payment_terms_label: string;
  special_payment_terms: string | null;
  effective_payment_terms_label: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IoSearchFilters = {
  q?: string;
  status?: string;
  clientId?: string;
};
