import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";
import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";

export type ClientProfitabilityRow = {
  client_id: string;
  client_name: string;
  client_code: string | null;
  group_name: string | null;
  revenue: number;
  gp: number;
  gp_after_vr: number;
  margin_percent: number;
};

export type ClientProfitabilityReportData = {
  year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  client_type: ClientTypeFilter;
  client_type_label: string;
  rows: ClientProfitabilityRow[];
  selected_client_ids: string[];
  period_note: string;
  data_scope_note: string;
};

export const MAX_CLIENT_PROFITABILITY_SELECTION = 3;
