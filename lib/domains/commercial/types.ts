/** Shared commercial domain types (Discovery → Shortlist → Quotation → Campaign). */

export type CommercialInputMode =
  | "cost_markup_pct"
  | "cost_gp_pct"
  | "cost_revenue"
  | "cost_gp_value";

export type CommercialInput = {
  mode: CommercialInputMode;
  cost: number | null | undefined;
  /** Percent value 0..<100 (e.g. 25 = 25%). Required for cost_gp_pct. */
  gpPct?: number | null;
  /** Required for cost_revenue. */
  revenue?: number | null;
  /** Required for cost_gp_value. */
  gpValue?: number | null;
};

export type CommercialResult = {
  cost: number;
  revenue: number;
  gpPct: number;
  gpValue: number;
  /** True when inputs were valid and a full result was computed. */
  valid: boolean;
  /** Non-fatal note explaining a guard/clamp (e.g. GP% >= 100). */
  warning: string | null;
};

export type AssignmentPricingMode = "package" | "per_deliverable";

export type PostScheduleEntry = {
  sequence: number;
  live_date: string | null;
  notes?: string | null;
  status?: string;
  platform?: string;
  deliverable_type?: string;
  revenue_per_post?: number;
  cost_per_post?: number;
  revenue_vat_percent?: number;
};

export type CommercialDeliverableRow = {
  /** Client-side stable id for React keys */
  id: string;
  platform: string;
  deliverable_type: string;
  quantity: number;
  unit_cost: number;
  revenue_before_vat: number;
  usage_rights_amount?: number;
  usage_rights_cost?: number;
  agency_fee_percent?: number;
  live_date: string | null;
  notes: string | null;
  schedule_mode: "single" | "expanded";
  post_schedules: PostScheduleEntry[];
};

export type CommercialSummary = {
  total_cost_before_vat: number;
  total_revenue_before_vat: number;
  gp: number;
  margin_percent: number;
  deliverable_units: number;
};

export type CommercialCurrency =
  | "EGP"
  | "USD"
  | "AED"
  | "SAR"
  | "EUR"
  | "GBP";

export type CommercialLineEgp = {
  costEgp: number;
  revenueEgp: number;
  gpValueEgp: number;
  afValueEgp?: number;
};

export type CommercialTotals = {
  totalCostEgp: number;
  totalRevenueEgp: number;
  totalGpValueEgp: number;
  /** Blended GP% = total GP value / total revenue, as a percent. 0 when no revenue. */
  totalGpPct: number;
  /** Blended PM% (markup margin) = total GP value / total cost, as a percent. 0 when no cost. */
  totalPmPct: number;
  /** Sum of line AF values (EGP). */
  totalAfValueEgp: number;
  /** Total GP + total AF (full agency margin). */
  totalAgencyMarginEgp: number;
  lineCount: number;
};

export type NormalizeLineInput = {
  mode: CommercialInputMode;
  cost: number | null | undefined;
  costCurrency: string;
  gpPct?: number | null;
  revenue?: number | null;
  gpValue?: number | null;
  afPct?: number | null;
  /** Pre-resolved rate from cost currency → EGP (1 when already EGP). */
  fxRateToEgp: number;
};

export type NormalizedCommercialLine = {
  commercial_input_mode: CommercialInputMode;
  cost: number;
  cost_currency: string;
  revenue: number;
  gp_pct: number;
  gp_value: number;
  af_pct: number;
  af_value: number;
  fx_rate_to_egp: number;
  cost_egp: number;
  revenue_egp: number;
  gp_value_egp: number;
  af_value_egp: number;
  valid: boolean;
  warning: string | null;
};
