export type PoStatus =
  | "draft"
  | "active"
  | "near_limit"
  | "exceeded"
  | "expired"
  | "closed";

export type PoTrackerRow = {
  campaign_id: string;
  campaign_name: string;
  campaign_document_number: string;
  group_id: string;
  group_name: string;
  client_id: string;
  client_name: string;
  brand_id: string;
  brand_name: string;
  country_code: string | null;
  account_manager_id: string | null;
  account_manager_name: string | null;
  campaign_currency: string;
  po_number: string | null;
  po_currency: string | null;
  po_exchange_rate: number | null;
  po_amount_original: number;
  po_amount_campaign_currency: number;
  po_consumed_amount: number;
  po_remaining_amount: number;
  po_remaining_percent: number | null;
  po_status: PoStatus;
  po_expiry_date: string | null;
  po_override_approved: boolean;
  fx_snapshot_at: string | null;
  is_over_consumed: boolean;
};

export type PoTrackerFilters = {
  group_id?: string;
  client_id?: string;
  brand_id?: string;
  campaign_id?: string;
  country_code?: string;
  currency?: string;
  po_status?: PoStatus;
  over_consumed_only?: boolean;
  expiring_soon?: boolean;
  account_manager_id?: string;
  date_from?: string;
  date_to?: string;
};

export type PoTrackerSummary = {
  total_po_amount: number;
  total_consumed: number;
  total_remaining: number;
  over_consumed_count: number;
  near_limit_count: number;
  expiring_soon_count: number;
};

export type PoTrackerWorkspaceData = {
  rows: PoTrackerRow[];
  summary: PoTrackerSummary;
  filter_options: {
    groups: { id: string; name: string }[];
    clients: { id: string; name: string; group_id: string | null }[];
    brands: { id: string; name: string; client_id: string }[];
    campaigns: { id: string; name: string; brand_id: string }[];
    currencies: { code: string; name: string }[];
    account_managers: { id: string; full_name: string | null; email: string }[];
  };
};
