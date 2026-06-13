import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";

export type DailyReportViewMode = "month" | "period";

export type DailyReportLayout = "stacked" | "columns";

export type DailyDrilldownRowType =
  | "day"
  | "subtotal"
  | "run_rate"
  | "vr"
  | "total_after_vr";

export type DailyDrilldownMetric = "revenue" | "gp" | "gp_percent";

export type DailyDrilldownClientRow = {
  client_id: string;
  client_name: string;
  revenue: number;
  gp: number;
  margin_percent: number;
  line_count: number;
};

export type DailyDrilldownData = {
  date: string | null;
  label: string;
  metric: DailyDrilldownMetric;
  clients: DailyDrilldownClientRow[];
};

export type DailyDrilldownQuery = {
  monthKey: string;
  rowType: DailyDrilldownRowType;
  metric: DailyDrilldownMetric;
  date?: string;
  currency?: string;
  clientType?: ClientTypeFilter;
};

export type DailyReportDayRow = {
  week: string;
  date: string;
  date_label: string;
  revenue: number;
  gp: number;
  gp_percent: number;
};

export type DailyReportSummary = {
  revenue: number;
  gp: number;
  gp_percent: number;
};

export type DailyReportMonthTable = {
  month_key: string;
  month_label: string;
  rows: DailyReportDayRow[];
  subtotal: DailyReportSummary;
  run_rate: DailyReportSummary;
  vr: Pick<DailyReportSummary, "gp">;
  total_after_vr: DailyReportSummary;
};

export type DailyReportData = {
  year: number;
  view_mode: DailyReportViewMode;
  layout: DailyReportLayout;
  month: number | null;
  period_scope: PnlPeriodScope | null;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  client_type: ClientTypeFilter;
  client_type_label: string;
  tables: DailyReportMonthTable[];
  data_scope_note: string;
};

export type DailyReportQuery = {
  year: number;
  viewMode: DailyReportViewMode;
  layout: DailyReportLayout;
  month: number;
  period: PnlPeriodScope;
  currency?: string;
  clientType?: ClientTypeFilter;
};

export type DailyLineFact = {
  client_id: string;
  client_name: string;
  period_date: string;
  revenue: number;
  ur_rev: number;
  agency_fees: number;
  gp: number;
  vr_refund: number;
  gp_after_vr: number;
  currency_code: string;
};
