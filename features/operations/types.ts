export type MovementType =
  | "brand_to_brand"
  | "client_to_client"
  | "group_to_group"
  | "vendor_to_vendor";

export type VendorMovementAssignmentRow = {
  id: string;
  campaign_line_id: string | null;
  campaign_id: string | null;
  campaign_document_number: string | null;
  campaign_name: string | null;
  line_document_number: string | null;
  line_name: string | null;
  agreed_fee: number;
  currency: string;
  billing_status: string | null;
  vendor_payment_status: string | null;
  revenue: number;
  gp: number;
};

export type MovementBatchStatus =
  | "draft"
  | "preview"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type MovementCampaignRow = {
  id: string;
  document_number: string;
  name: string;
  status: string;
  group_id: string | null;
  group_name: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  revenue: number;
  gp: number;
  billing_status: string;
  invoice_status: string;
  live_date: string | null;
  created_at: string;
};

export type MovementPreview = {
  campaign_count: number;
  total_revenue: number;
  total_gp: number;
  total_invoices: number;
  affected_collections: number;
  campaigns: MovementCampaignRow[];
};

export type MovementBatchRow = {
  id: string;
  document_number: string;
  movement_type: MovementType;
  status: MovementBatchStatus;
  reason: string;
  campaign_count: number;
  total_revenue: number;
  total_gp: number;
  total_invoices: number;
  executed_at: string | null;
  created_at: string;
  created_by_name: string | null;
};

export type HierarchyOption = {
  id: string;
  label: string;
  sublabel?: string;
};

export type MoveBetweenAccountsFormState = {
  movementType: MovementType;
  sourceGroupId: string;
  sourceClientId: string;
  sourceBrandId: string;
  destGroupId: string;
  destClientId: string;
  destBrandId: string;
  selectedCampaignIds: string[];
  reason: string;
};
