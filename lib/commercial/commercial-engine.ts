/**
 * Pure commercial calculation engine (no UI, no DB) for Discovery / Shortlist /
 * Quotation commercials. Unit-tested in `commercial-engine.test.ts`.
 *
 * Three input modes (spec §5):
 *   A) cost_gp_pct   : Cost + GP%      → Revenue, GP Value
 *   B) cost_revenue  : Cost + Revenue  → GP%, GP Value
 *   C) cost_gp_value : Cost + GP Value → Revenue, GP%
 *
 * Canonical formulas:
 *   Revenue  = Cost / (1 - GP%)        (GP% as a fraction, 0..<1)
 *   GP Value = Revenue - Cost
 *   GP%      = GP Value / Revenue      (margin on revenue, not markup on cost)
 *
 * GP% is stored/exchanged as a PERCENT number (e.g. 25 means 25%). Internally we
 * convert to a fraction for math. GP% must be in [0, 100) — 100%+ implies
 * infinite/negative revenue and is rejected.
 */

export type CommercialInputMode = "cost_gp_pct" | "cost_revenue" | "cost_gp_value";

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

/** Money rounds to 2 dp; percentages to 4 dp (matches numeric(7,4) column). */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function toNumber(value: number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const EMPTY: CommercialResult = {
  cost: 0,
  revenue: 0,
  gpPct: 0,
  gpValue: 0,
  valid: false,
  warning: null,
};

/** GP% upper guard: must be strictly below 100% (revenue would be ∞/negative). */
export const MAX_GP_PCT = 100;

export function computeCommercials(input: CommercialInput): CommercialResult {
  const cost = round2(toNumber(input.cost));

  if (cost < 0) {
    return { ...EMPTY, cost, warning: "Cost cannot be negative." };
  }

  switch (input.mode) {
    case "cost_gp_pct": {
      const gpPct = round4(toNumber(input.gpPct));
      if (gpPct >= MAX_GP_PCT) {
        return {
          ...EMPTY,
          cost,
          gpPct,
          warning: "GP% must be below 100%.",
        };
      }
      if (gpPct < 0) {
        return { ...EMPTY, cost, gpPct, warning: "GP% cannot be negative." };
      }
      const fraction = gpPct / 100;
      // Revenue = Cost / (1 - GP%). When cost is 0, revenue is 0.
      const revenue = round2(cost === 0 ? 0 : cost / (1 - fraction));
      const gpValue = round2(revenue - cost);
      return { cost, revenue, gpPct, gpValue, valid: true, warning: null };
    }

    case "cost_revenue": {
      const revenue = round2(toNumber(input.revenue));
      if (revenue < 0) {
        return { ...EMPTY, cost, revenue, warning: "Revenue cannot be negative." };
      }
      const gpValue = round2(revenue - cost);
      // GP% = GP Value / Revenue. Undefined when revenue is 0.
      const gpPct = revenue === 0 ? 0 : round4((gpValue / revenue) * 100);
      const warning =
        revenue > 0 && revenue < cost ? "Revenue is below cost (negative GP)." : null;
      return { cost, revenue, gpPct, gpValue, valid: true, warning };
    }

    case "cost_gp_value": {
      const gpValue = round2(toNumber(input.gpValue));
      const revenue = round2(cost + gpValue);
      const gpPct = revenue === 0 ? 0 : round4((gpValue / revenue) * 100);
      const warning =
        gpValue < 0 ? "GP value is negative (revenue below cost)." : null;
      return { cost, revenue, gpPct, gpValue, valid: true, warning };
    }

    default:
      return EMPTY;
  }
}
