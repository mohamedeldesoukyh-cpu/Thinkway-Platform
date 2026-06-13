import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";

export type VrReportColumn = {
  key: string;
  label: string;
  monthKey: string;
};

export type VrReportRow = {
  client_id: string;
  client_name: string;
  group_id: string | null;
  group_name: string;
  revenue: number;
  vr_rate_percent: number;
  monthly_vr: Record<string, number>;
  total_vr: number;
};

export type VrReportTotals = {
  revenue: number;
  monthly_vr: Record<string, number>;
  total_vr: number;
};

export type VrReportData = {
  year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  client_type: ClientTypeFilter;
  client_type_label: string;
  columns: VrReportColumn[];
  rows: VrReportRow[];
  totals: VrReportTotals;
  period_note: string;
  data_scope_note: string;
};
