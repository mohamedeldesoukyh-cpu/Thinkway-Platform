export type MovementType = "brand_to_brand" | "client_to_client" | "group_to_group";

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
