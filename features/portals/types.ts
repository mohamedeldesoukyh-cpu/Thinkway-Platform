export type PortalPaymentStatus = "Pending" | "Invoiced" | "Partially Paid" | "Paid";
export type ClientInvoiceStatus = "Draft" | "Issued" | "Partially Paid" | "Paid";
export type PortalApprovalStatus = "Pending" | "Approved" | "Rejected";

export type CreatorCampaignDetail = {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  campaign_status: string;
  brief: string | null;
  start_date: string | null;
  end_date: string | null;
  assignment_id: string;
  assignment_status: string;
  agreed_amount: number;
  currency_code: string;
  vendor_io_status: string | null;
  vendor_io_id: string | null;
  deliverables: CreatorDeliverableRow[];
};

export type PortalUploadRow = {
  id: string;
  file_name: string | null;
  external_link: string | null;
  storage_path: string | null;
  created_at: string;
};

export type CreatorCampaignRow = {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  assignment_id: string;
  assignment_status: string;
  agreed_amount: number;
  currency_code: string;
  vendor_payment_status: string;
  start_date: string | null;
  end_date: string | null;
  vendor_io_status: string | null;
  deliverable_total: number;
  pending_deliverables: number;
  publication_total: number;
  recent_publication_status: string | null;
};

export type CreatorDeliverableRow = {
  id: string;
  document_number: string;
  campaign_header_id: string;
  campaign_name: string;
  title: string;
  deliverable_type: string;
  platform: string | null;
  status: string;
  due_date: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  published_at: string | null;
  content_url: string | null;
};

export type CreatorPublicationRow = {
  id: string;
  campaign_header_id: string;
  campaign_name: string;
  platform: string;
  publication_type: string;
  content_url: string | null;
  publication_date: string | null;
  status: string;
  notes: string | null;
};

export type CreatorVendorIoRow = {
  id: string;
  assignment_id: string;
  campaign_header_id: string;
  campaign_name: string;
  amount: number;
  currency_code: string;
  status: string;
  sent_at: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
};

export type CreatorPaymentRow = {
  assignment_id: string;
  campaign_header_id: string;
  campaign_name: string;
  agreed_amount: number;
  invoiced_amount: number;
  paid_amount: number;
  pending_amount: number;
  payment_status: PortalPaymentStatus;
  vendor_payment_status: string;
  currency_code: string;
};

export type PortalNotificationRow = {
  id: string;
  title: string;
  message: string;
  event_type: string;
  created_at: string;
  is_read: boolean;
  campaign_header_id: string | null;
};

export type CreatorDashboardSummary = {
  active_campaigns: number;
  pending_deliverables: number;
  pending_vendor_io_approvals: number;
  pending_payments: number;
  recent_publications: CreatorPublicationRow[];
  notifications: PortalNotificationRow[];
};

export type ClientCampaignRow = {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  client_io_status: string | null;
  deliverable_total: number;
  pending_approvals: number;
  publication_total: number;
  latest_publication_status: string | null;
};

export type ClientApprovalRow = {
  id: string;
  entity_type: "publication" | "deliverable" | "client_io";
  entity_id: string;
  campaign_header_id: string;
  campaign_name: string;
  title: string;
  status: PortalApprovalStatus;
  approved_by_name: string | null;
  approved_at: string | null;
};

export type ClientInvoiceRow = {
  id: string;
  document_number: string;
  campaign_header_id: string | null;
  campaign_name: string | null;
  issue_date: string;
  due_date: string | null;
  amount_total: number;
  amount_paid: number;
  amount_pending: number;
  status: ClientInvoiceStatus;
  currency: string;
};

export type ClientIoRow = {
  id: string;
  campaign_header_id: string;
  client_id: string;
  status: string;
  sent_at: string | null;
  approved_at: string | null;
  approved_by_name: string | null;
  terms_text: string | null;
  billing_terms: string | null;
  campaign: { name: string } | null;
};

export type ClientReportRow = {
  campaign_header_id: string;
  campaign_name: string;
  campaign_status: string;
  start_date: string | null;
  end_date: string | null;
  total_publications: number;
  approved_publications: number;
  total_deliverables: number;
  approved_deliverables: number;
};

export type ClientDashboardSummary = {
  active_campaigns: number;
  pending_approvals: number;
  pending_client_io: number;
  open_invoices: number;
  recent_publications: CreatorPublicationRow[];
  notifications: PortalNotificationRow[];
};
