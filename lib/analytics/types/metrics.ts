import type { AnalyticsRollupLevel } from "@/lib/analytics/types/filters";

/** Standard financial metrics (amounts in native currency unless noted). */
export type FinancialMetrics = {
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  achieved_revenue: number;
  unachieved_revenue: number;
  invoiced_revenue: number;
  collected_revenue: number;
  outstanding_revenue: number;
  vendor_payable: number;
  remaining_to_invoice: number;
  /** Planned vs actual — reserved for FX / budget modules. */
  budget_amount: number;
  actual_amount: number;
  budget_variance: number;
};

export type AnalyticsCurrencyContext = {
  /** Primary currency when a single currency dominates the slice. */
  primary_currency: string | null;
  /** True when slice contains multiple currencies. */
  is_mixed_currency: boolean;
  /** ISO codes present in the slice. */
  currencies: string[];
  /** Display label for mixed slices, e.g. "Mixed (USD, GBP)". */
  mixed_label: string | null;
};

export type CampaignAnalyticsFact = {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  client_id: string;
  client_name: string;
  brand_id: string | null;
  brand_name: string | null;
  team_id: string | null;
  team_name: string | null;
  country_code: string | null;
  currency_code: string;
  line_count: number;
  /** Campaign start month key (YYYY-MM) for trend charts. */
  period_month: string | null;
  metrics: FinancialMetrics;
};

export type AnalyticsRollupNode = {
  level: AnalyticsRollupLevel;
  key: string;
  label: string;
  currency: AnalyticsCurrencyContext;
  metrics: FinancialMetrics;
  campaign_count: number;
  child_keys?: string[];
};
