import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";
import type { BusinessFunction } from "@/types/database";

export type RevenueByFunctionFilter = "all" | BusinessFunction;

export type RevenueByFunctionLineFact = {
  client_id: string;
  client_name: string;
  period_month: string | null;
  revenue: number;
  ur_rev: number;
  agency_fees: number;
  gp_after_vr: number;
  currency_code: string;
  account_manager_id: string | null;
  account_manager_name: string | null;
  business_function: BusinessFunction | null;
};

export type RevenueByFunctionUserOption = {
  id: string;
  name: string;
  business_function: BusinessFunction | null;
};

export type RevenueByFunctionRow = {
  user_id: string | null;
  user_name: string;
  business_function: BusinessFunction | null;
  business_function_label: string;
  revenue: number;
  gp: number;
  gp_percent: number;
  is_summary?: boolean;
};

export type RevenueByFunctionReportData = {
  year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  function_filter: RevenueByFunctionFilter;
  function_filter_label: string;
  user_filter: string;
  user_filter_label: string;
  client_type: ClientTypeFilter;
  client_type_label: string;
  rows: RevenueByFunctionRow[];
  summary_rows: RevenueByFunctionRow[];
  user_options: RevenueByFunctionUserOption[];
  period_note: string;
  data_scope_note: string;
};
