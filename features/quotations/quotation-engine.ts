/**
 * Pure quotation/commercial line engine (no DB). Normalizes a raw commercial
 * input (mode + cost/currency + one of gp%/revenue/gp value) into the canonical
 * persisted shape: original-currency commercials PLUS EGP-converted values,
 * given a pre-resolved FX rate. Used by both shortlist Commercial tab and
 * quotation items so the math is identical everywhere. Unit-tested.
 */
import {
  computeAgencyFee,
  computeCommercials,
  type CommercialInput,
  type CommercialInputMode,
} from "@/lib/commercial/commercial-engine";
import {
  aggregateEgpTotals,
  REPORTING_CURRENCY,
  toEgp,
  type CommercialTotals,
} from "@/lib/commercial/fx-aggregation";

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

export function normalizeCommercialLine(
  input: NormalizeLineInput
): NormalizedCommercialLine {
  const currency = (input.costCurrency || REPORTING_CURRENCY).toUpperCase();
  const isEgp = currency === REPORTING_CURRENCY;
  // EGP lines always use rate 1; otherwise use the resolved rate (>0).
  const rate = isEgp ? 1 : input.fxRateToEgp > 0 ? input.fxRateToEgp : 1;

  const commercial: CommercialInput = {
    mode: input.mode,
    cost: input.cost,
    gpPct: input.gpPct,
    revenue: input.revenue,
    gpValue: input.gpValue,
  };
  const r = computeCommercials(commercial);
  const af = computeAgencyFee({
    revenue: r.revenue,
    afPct: input.afPct,
    gpValue: r.gpValue,
  });

  return {
    commercial_input_mode: input.mode,
    cost: r.cost,
    cost_currency: currency,
    revenue: r.revenue,
    gp_pct: r.gpPct,
    gp_value: r.gpValue,
    af_pct: af.afPct,
    af_value: af.afValue,
    fx_rate_to_egp: rate,
    cost_egp: toEgp(r.cost, rate),
    revenue_egp: toEgp(r.revenue, rate),
    gp_value_egp: toEgp(r.gpValue, rate),
    af_value_egp: toEgp(af.afValue, rate),
    valid: r.valid,
    warning: r.warning,
  };
}

/** Aggregate normalized lines into quotation header totals (EGP). */
export function computeQuotationTotals(
  lines: Pick<
    NormalizedCommercialLine,
    "cost_egp" | "revenue_egp" | "gp_value_egp" | "af_value_egp"
  >[]
): CommercialTotals {
  return aggregateEgpTotals(
    lines.map((l) => ({
      costEgp: l.cost_egp,
      revenueEgp: l.revenue_egp,
      gpValueEgp: l.gp_value_egp,
      afValueEgp: l.af_value_egp,
    }))
  );
}
