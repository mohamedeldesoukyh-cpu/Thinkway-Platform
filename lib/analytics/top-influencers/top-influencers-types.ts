import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";

export type TopInfluencersMetric = "spending" | "revenue" | "gp";

export type TopInfluencersClientTypeFilter = ClientTypeFilter;

export type TopInfluencersRow = {
  rank: number;
  influencer_id: string;
  influencer_name: string;
  document_number: string;
  spending: number;
  revenue: number;
  gp: number;
  gp_percent: number;
};

export type TopInfluencersReportData = {
  year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  metric: TopInfluencersMetric;
  metric_label: string;
  limit: number;
  client_type: TopInfluencersClientTypeFilter;
  client_type_label: string;
  rows: TopInfluencersRow[];
  period_note: string;
  data_scope_note: string;
};

export const TOP_INFLUENCERS_MIN_LIMIT = 1;
export const TOP_INFLUENCERS_MAX_LIMIT = 20;
export const TOP_INFLUENCERS_DEFAULT_LIMIT = 10;

export const TOP_INFLUENCERS_LIMIT_OPTIONS = Array.from(
  { length: TOP_INFLUENCERS_MAX_LIMIT },
  (_, index) => index + 1
);
