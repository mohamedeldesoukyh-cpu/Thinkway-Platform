import type { ClientTypeFilter } from "@/lib/analytics/filters/client-type-filter";
import type { AgencyOrDirect } from "@/types/database";
import type { PnlPeriodScope } from "@/lib/analytics/pnl/pnl-periods";

export type TopClientsMetric = "revenue" | "gp";

export type TopClientsClientTypeFilter = ClientTypeFilter;

export type TopClientsRow = {
  rank: number;
  client_id: string;
  client_name: string;
  agency_or_direct: AgencyOrDirect | null;
  revenue: number;
  gp: number;
  gp_percent: number;
};

export type TopClientsReportData = {
  year: number;
  period_scope: PnlPeriodScope;
  period_label: string;
  display_currency: string;
  available_currencies: string[];
  metric: TopClientsMetric;
  metric_label: string;
  limit: number;
  client_type: TopClientsClientTypeFilter;
  client_type_label: string;
  rows: TopClientsRow[];
  period_note: string;
  data_scope_note: string;
};

export const TOP_CLIENTS_MIN_LIMIT = 1;
export const TOP_CLIENTS_MAX_LIMIT = 20;
export const TOP_CLIENTS_DEFAULT_LIMIT = 10;

export const TOP_CLIENTS_LIMIT_OPTIONS = Array.from(
  { length: TOP_CLIENTS_MAX_LIMIT },
  (_, index) => index + 1
);
