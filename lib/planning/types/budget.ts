import type { PlanningDimension } from "@/lib/planning/types/dimensions";

export type BudgetVersionStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "locked"
  | "archived";

export type BudgetPeriodType = "monthly" | "quarterly" | "yearly";

export type BudgetFinancialFields = {
  revenue_budget: number;
  cost_budget: number;
  gp_budget: number;
  margin_budget: number;
  collections_budget: number;
  vendor_cost_budget: number;
  po_budget: number;
};

export type BudgetVersion = {
  id: string;
  document_number: string;
  name: string;
  fiscal_year: number;
  status: BudgetVersionStatus;
  scenario_id: string | null;
  currency_code: string;
  version_number: number;
  parent_version_id: string | null;
  notes: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  locked_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BudgetPeriod = {
  id: string;
  budget_version_id: string;
  period_type: BudgetPeriodType;
  period_key: string;
  period_start: string;
  period_end: string;
  sort_order: number;
};

export type BudgetLine = PlanningDimension &
  BudgetFinancialFields & {
    id: string;
    budget_version_id: string;
    budget_period_id: string | null;
    currency_code: string;
    line_label: string | null;
    sort_order: number;
  };

export type BudgetAllocation = {
  id: string;
  budget_line_id: string;
  allocation_type: string;
  target_dimension: string;
  target_id: string | null;
  allocated_amount: number;
  allocation_percent: number | null;
  currency_code: string;
  notes: string | null;
};
