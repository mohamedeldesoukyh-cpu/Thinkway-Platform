export type ClientIoStatus = "draft" | "sent" | "approved";
export type VendorIoStatus = "draft" | "sent" | "approved" | "rejected";

export type ClientIoRow = {
  id: string;
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
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type VendorIoRow = {
  id: string;
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
  terms_html: string | null;
  terms_text: string | null;
  usage_rights: string | null;
  exclusivity: string | null;
  attachment_url: string | null;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejection_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IoSearchFilters = {
  q?: string;
  status?: string;
};
