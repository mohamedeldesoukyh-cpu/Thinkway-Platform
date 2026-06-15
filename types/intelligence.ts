export type IntelligenceSheet = "2023" | "2024" | "2025" | "2026";

export type HistoricalCampaignsRawRow = {
  id: string;
  source_sheet: IntelligenceSheet;
  source_row_number: number;
  loaded_at: string;
  payload: Record<string, string | null>;
  row_hash: string;
};

export type HistoricalInfluencersRawRow = {
  id: string;
  source_row_number: number;
  loaded_at: string;
  payload: Record<string, string | null>;
  row_hash: string;
};

export type IntClientRow = {
  id: string;
  client_name_raw: string;
  group_name_raw: string | null;
  client_type_report: string | null;
  client_age_bucket: string | null;
  category_raw: string | null;
  subcategory_raw: string | null;
  resolved_group_id: string | null;
  resolved_client_id: string | null;
  match_confidence: number;
  source_keys: string[];
  created_at: string;
  updated_at: string;
};

export type IntBrandRow = {
  id: string;
  brand_name_raw: string;
  client_name_raw: string | null;
  commercial_model: string | null;
  category_raw: string | null;
  subcategory_raw: string | null;
  resolved_brand_id: string | null;
  match_confidence: number;
  source_keys: string[];
  created_at: string;
  updated_at: string;
};

export type IntInfluencerRow = {
  id: string;
  display_name_raw: string;
  legacy_name: string | null;
  username: string | null;
  platform: string | null;
  country: string | null;
  nationality: string | null;
  gender: string | null;
  tier: string | null;
  content_category: string | null;
  resolved_influencer_id: string | null;
  match_confidence: number;
  source_keys: string[];
  created_at: string;
  updated_at: string;
};

export type IntCampaignRow = {
  id: string;
  source_line_id: string;
  source_campaign_key: string | null;
  source_line_key: string | null;
  source_sheet: IntelligenceSheet;
  source_row_number: number | null;
  raw_id: string | null;
  ad_live_month: string | null;
  ad_live_date: string | null;
  budget_month: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  market_entity: string | null;
  channel: string | null;
  went_live: boolean | null;
  ad_live_week: number | null;
  revenue_usd: number | null;
  cost_usd: number | null;
  gp_usd: number | null;
  margin_pct: number | null;
  markup_pct: number | null;
  io_amount_local: number | null;
  io_currency: string | null;
  billing_moved: string | null;
  invoiced_flag: string | null;
  invoice_number_ref: string | null;
  vendor_paid_flag: string | null;
  locked_flag: string | null;
  direct_agency: string | null;
  client_type_report: string | null;
  ops_team: string | null;
  planning_status: string | null;
  category_raw: string | null;
  subcategory_raw: string | null;
  agency_name_raw: string | null;
  account_manager_raw: string | null;
  influencer_name_raw: string | null;
  client_name_raw: string | null;
  group_name_raw: string | null;
  brand_name_raw: string | null;
  int_client_id: string | null;
  int_brand_id: string | null;
  int_influencer_id: string | null;
  resolved_header_id: string | null;
  resolved_line_id: string | null;
  match_confidence: number;
  period_year: number | null;
  created_at: string;
  updated_at: string;
};

export type IntPricingHistoryRow = {
  id: string;
  int_influencer_id: string | null;
  rate_text: string | null;
  parsed_rate_usd: number | null;
  parsed_rate_local: number | null;
  currency: string | null;
  platform: string | null;
  effective_period: string | null;
  source: "database_sheet" | "implied_from_line";
  created_at: string;
};

export type IntMarginHistoryRow = {
  id: string;
  int_campaign_id: string;
  source_line_id: string;
  revenue_usd: number | null;
  cost_usd: number | null;
  gp_usd: number | null;
  margin_pct: number | null;
  markup_pct: number | null;
  market_entity: string | null;
  channel: string | null;
  campaign_type: string | null;
  category_raw: string | null;
  brand_name_raw: string | null;
  influencer_tier: string | null;
  below_threshold_15pct: boolean;
  period_year: number | null;
  created_at: string;
};

export type IntBenchmarkRow = {
  id: string;
  benchmark_key: string;
  period_year: number | null;
  median_cost_usd: number | null;
  p25_cost_usd: number | null;
  p75_cost_usd: number | null;
  median_revenue_usd: number | null;
  median_margin_pct: number | null;
  p25_margin_pct: number | null;
  p75_margin_pct: number | null;
  sample_size: number;
  dimensions: Record<string, string | number | null>;
  computed_at: string;
};

export type HarmonizedCampaignRow = {
  source_sheet: IntelligenceSheet;
  source_row_number: number;
  source_line_id: string;
  source_campaign_key: string | null;
  source_line_key: string | null;
  ad_live_month: string | null;
  ad_live_date: string | null;
  budget_month: string | null;
  campaign_name: string | null;
  campaign_type: string | null;
  market_entity: string | null;
  channel: string | null;
  went_live: boolean | null;
  ad_live_week: number | null;
  revenue_usd: number | null;
  cost_usd: number | null;
  gp_usd: number | null;
  margin_pct: number | null;
  markup_pct: number | null;
  io_amount_local: number | null;
  io_currency: string | null;
  billing_moved: string | null;
  invoiced_flag: string | null;
  invoice_number_ref: string | null;
  vendor_paid_flag: string | null;
  locked_flag: string | null;
  direct_agency: string | null;
  client_type_report: string | null;
  ops_team: string | null;
  planning_status: string | null;
  category_raw: string | null;
  subcategory_raw: string | null;
  agency_name_raw: string | null;
  account_manager_raw: string | null;
  influencer_name_raw: string | null;
  client_name_raw: string | null;
  group_name_raw: string | null;
  brand_name_raw: string | null;
  period_year: number | null;
};

export type IntelligenceOverviewStats = {
  totalCampaignLines: number;
  totalInfluencers: number;
  totalRevenueUsd: number;
  medianMarginPct: number | null;
  lowMarginLineCount: number;
  benchmarkSliceCount: number;
  dataAvailable: boolean;
};

export type IntelligenceTab = "influencers" | "benchmarks" | "margin";

export type TopInfluencerIntelRow = {
  id: string;
  display_name_raw: string;
  username: string | null;
  platform: string | null;
  country: string | null;
  tier: string | null;
  line_count: number;
  total_cost_usd: number;
  median_cost_usd: number;
  median_margin_pct: number | null;
  match_confidence: number;
};

export type BenchmarkSliceRow = {
  id: string;
  benchmark_key: string;
  period_year: number | null;
  platform: string | null;
  category: string | null;
  market_entity: string | null;
  tier: string | null;
  median_cost_usd: number | null;
  median_margin_pct: number | null;
  p25_margin_pct: number | null;
  p75_margin_pct: number | null;
  sample_size: number;
};

export type MarginAlertRow = {
  id: string;
  source_line_id: string;
  campaign_name: string | null;
  brand_name_raw: string | null;
  influencer_name_raw: string | null;
  margin_pct: number | null;
  revenue_usd: number | null;
  cost_usd: number | null;
  market_entity: string | null;
  channel: string | null;
  period_year: number | null;
  client_type_report: string | null;
};

export type IntelligenceWorkspacePayload = {
  tab: IntelligenceTab;
  stats: IntelligenceOverviewStats;
  topInfluencers: TopInfluencerIntelRow[];
  benchmarks: BenchmarkSliceRow[];
  marginAlerts: MarginAlertRow[];
  warnings: string[];
};
