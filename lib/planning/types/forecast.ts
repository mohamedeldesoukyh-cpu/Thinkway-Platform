import type { PlanningDimension } from "@/lib/planning/types/dimensions";

export type ForecastVersionStatus = "draft" | "active" | "archived";

export type ForecastFinancialFields = {
  revenue_forecast: number;
  cost_forecast: number;
  gp_forecast: number;
  margin_forecast: number;
  collections_forecast: number;
  vendor_cost_forecast: number;
  po_forecast: number;
};

export type ForecastVersion = {
  id: string;
  document_number: string;
  name: string;
  fiscal_year: number;
  status: ForecastVersionStatus;
  budget_version_id: string | null;
  scenario_id: string | null;
  currency_code: string;
  version_number: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ForecastLine = PlanningDimension &
  ForecastFinancialFields & {
    id: string;
    forecast_version_id: string;
    budget_period_id: string | null;
    currency_code: string;
    line_label: string | null;
    sort_order: number;
  };
