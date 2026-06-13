import type { buildCurrencyContext } from "@/lib/analytics/currency/engine";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";

export type PnlMetricKey =
  | "rev"
  | "ur_rev"
  | "agency_fees"
  | "total_revenue"
  | "cost"
  | "gp"
  | "vr_refund"
  | "gp_after_vr";

export type PnlRevenueBreakdown = {
  rev: number;
  ur: number;
  af: number;
};

export type PnlClientRow = {
  client_id: string;
  client_name: string;
  revenue: number;
  ur_rev: number;
  agency_fees: number;
  billable_revenue: number;
  cost: number;
  gp: number;
  vr_refund: number;
  gp_after_vr: number;
  margin_percent: number;
  line_count: number;
};

export type PnlPeriodColumn = {
  key: string;
  label: string;
  monthKey: string | "total";
};

export type PnlComparisonCell = {
  current: number;
  prior: number;
  variance_amount: number;
  variance_percent: number | null;
};

export type PnlComparisonMetricRow = {
  key: PnlMetricKey;
  label: string;
  section?: "revenue" | "vr";
  cells: Record<string, PnlComparisonCell>;
  total: PnlComparisonCell;
};

export type PnlComparisonReportData = {
  current_year: number;
  prior_year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  client_type: ClientTypeFilter;
  client_type_label: string;
  columns: PnlPeriodColumn[];
  metric_rows: PnlComparisonMetricRow[];
  currency: ReturnType<typeof buildCurrencyContext>;
  client_breakdowns: Record<string, PnlClientRow[]>;
  period_note: string;
  data_scope_note: string;
};

export type PnlLineFact = {
  client_id: string;
  client_name: string;
  group_id: string | null;
  group_name: string | null;
  period_month: string | null;
  revenue: number;
  ur_rev: number;
  agency_fees: number;
  cost: number;
  gp: number;
  vr_refund: number;
  gp_after_vr: number;
  vr_rate_percent: number;
  currency_code: string;
};

/** @deprecated Use PnlComparisonReportData */
export type PnlMetricRow = {
  key: PnlMetricKey;
  label: string;
  values: Record<string, number>;
  total: number;
};

/** @deprecated Use PnlComparisonReportData */
export type PnlReportData = {
  year: number;
  months: string[];
  currency: ReturnType<typeof buildCurrencyContext>;
  metric_rows: PnlMetricRow[];
  client_breakdowns: Record<string, PnlClientRow[]>;
  period_note: string;
};
