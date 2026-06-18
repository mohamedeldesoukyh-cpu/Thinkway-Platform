import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";

export const UNCATEGORIZED_CATEGORY_SLUG = "uncategorized";
export const UNCATEGORIZED_CATEGORY_LABEL = "Uncategorized";

export type SpendingByCategoryGroupBy = "category" | "subcategory";
export type SpendingByCategoryView = "summary" | "analysis";

export type SpendingByCategoryLineFact = {
  client_id: string;
  client_name: string;
  client_category: string | null;
  client_subcategory: string | null;
  brand_id: string | null;
  brand_name: string | null;
  campaign_header_id: string;
  campaign_code: string | null;
  campaign_name: string | null;
  period_month: string | null;
  billable_revenue: number;
  vr_refund: number;
  gp_after_vr: number;
  currency_code: string;
};

export type SpendingByCategorySummaryRow = {
  category_slug: string;
  category_label: string;
  subcategory_slug: string | null;
  subcategory_label: string | null;
  client_count: number;
  campaign_count: number;
  total_spending: number;
  percent_of_total: number;
  vr_amount: number;
  avg_margin_percent: number;
};

export type SpendingByCategoryCampaignDetail = {
  campaign_header_id: string;
  campaign_label: string;
  brand_name: string | null;
  spending: number;
  vr_amount: number;
  margin_percent: number;
};

export type SpendingByCategoryClientDetail = {
  client_id: string;
  client_name: string;
  spending: number;
  vr_amount: number;
  margin_percent: number;
  campaigns: SpendingByCategoryCampaignDetail[];
};

export type SpendingByCategoryDetailGroup = {
  category_slug: string;
  category_label: string;
  subcategory_slug: string | null;
  subcategory_label: string | null;
  total_spending: number;
  clients: SpendingByCategoryClientDetail[];
};

export type SpendingByCategoryKpis = {
  total_spending: number;
  category_count: number;
  top_category_label: string | null;
  top_category_share_percent: number;
};

export type SpendingByCategoryReportData = {
  year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  group_by: SpendingByCategoryGroupBy;
  view: SpendingByCategoryView;
  has_mixed_source_currencies: boolean;
  mixed_currency_codes: string[];
  kpis: SpendingByCategoryKpis;
  summary_rows: SpendingByCategorySummaryRow[];
  detail_groups: SpendingByCategoryDetailGroup[];
  period_note: string;
  data_scope_note: string;
};
