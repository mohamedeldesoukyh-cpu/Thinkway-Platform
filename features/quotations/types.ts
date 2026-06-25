import type { CommercialInputMode, QuotationStatus } from "@/types/database";

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; message: string };

export type QuotationDeliverable = {
  platform: string;
  type: string;
  quantity: number;
};

export type QuotationItemRow = {
  id: string;
  influencer_id: string | null;
  profile_id: string | null;
  unified_id: string | null;
  source_shortlist_item_id: string | null;
  creator_name: string | null;
  platform: string | null;
  handle: string | null;
  followers: number | null;
  engagement_rate: number | null;
  country_code: string | null;
  deliverables: QuotationDeliverable[];
  commercial_input_mode: CommercialInputMode;
  cost: number;
  cost_currency: string;
  revenue: number;
  gp_pct: number;
  gp_value: number;
  fx_rate_to_egp: number;
  cost_egp: number;
  revenue_egp: number;
  gp_value_egp: number;
  sort_order: number;
};

export type QuotationRevisionRow = {
  id: string;
  version: string;
  updated_by_name: string | null;
  change_summary: string | null;
  created_at: string;
};

export type QuotationListRow = {
  id: string;
  serial_number: string | null;
  name: string;
  status: QuotationStatus;
  client_name: string | null;
  brand_name: string | null;
  campaign_name: string | null;
  shortlist_id: string | null;
  total_cost_egp: number;
  total_revenue_egp: number;
  total_gp_value_egp: number;
  total_gp_pct: number;
  item_count: number;
  is_archived: boolean;
  issue_date: string | null;
  validity_date: string | null;
  version: string;
  created_at: string;
  updated_at: string;
};

export type QuotationDetail = {
  id: string;
  serial_number: string | null;
  name: string;
  status: QuotationStatus;
  shortlist_id: string | null;
  client_id: string | null;
  client_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  campaign_header_id: string | null;
  campaign_name: string | null;
  owner_id: string | null;
  owner_name: string | null;
  approved_by: string | null;
  approved_at: string | null;
  currency: string;
  total_cost_egp: number;
  total_revenue_egp: number;
  total_gp_value_egp: number;
  total_gp_pct: number;
  gp_target_pct: number;
  notes: string | null;
  terms: string | null;
  prepared_by_name: string | null;
  reviewed_by_name: string | null;
  client_signature_name: string | null;
  client_signed_at: string | null;
  issue_date: string;
  validity_date: string | null;
  version: string;
  department: string | null;
  change_summary: string | null;
  shared_with_client: boolean;
  client_visible: boolean;
  is_archived: boolean;
  is_expired: boolean;
  valid_days_remaining: number | null;
  created_at: string;
  updated_at: string;
  items: QuotationItemRow[];
  revisions: QuotationRevisionRow[];
  canManage: boolean;
  /** Aggregated reach / engagement for cover & summary KPIs. */
  estimated_reach: number;
  estimated_engagement_rate: number | null;
};

export type QuotationFormOptions = {
  clients: Array<{ id: string; name: string; legal_name: string | null }>;
  brands: Array<{ id: string; name: string; client_id: string }>;
  campaigns: Array<{ id: string; name: string; document_number: string | null }>;
};
