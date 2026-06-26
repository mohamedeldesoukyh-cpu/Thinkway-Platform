/**
 * Pure commercial calculation engine (no UI, no DB) for Discovery / Shortlist /
 * Quotation commercials. Unit-tested in `commercial-engine.test.ts`.
 *
 * Four input modes (spec §5 + quotation markup):
 *   A) cost_markup_pct : Cost + Markup% → Revenue, GP Value (Revenue = Cost × (1 + Markup%))
 *   B) cost_gp_pct     : Cost + GP Margin% → Revenue, GP Value (Revenue = Cost / (1 - GP%))
 *   C) cost_revenue    : Cost + Revenue → GP%, GP Value
 *   D) cost_gp_value   : Cost + GP Value → Revenue, GP%
 *
 * Margin formula (cost_gp_pct):
 *   Revenue  = Cost / (1 - GP%)        (GP% as a fraction, 0..<1)
 * Markup formula (cost_markup_pct):
 *   Revenue  = Cost × (1 + Markup%)
 * Shared:
 *   GP Value = Revenue - Cost
 *   GP%      = GP Value / Revenue      (margin on revenue)
 *
 * Agency Fee (AF) on quotations / client cost:
 *   AF Value         = Revenue × (AF% / 100)
 *   Agency Margin    = GP Value + AF Value   (total agency earnings on the line)
 *
 * GP% is stored/exchanged as a PERCENT number (e.g. 25 means 25%). Internally we
 * convert to a fraction for math. GP% must be in [0, 100) — 100%+ implies
 * infinite/negative revenue and is rejected.
 */

import type {
  CommercialInput,
  CommercialInputMode,
  CommercialResult,
} from "@/lib/domains/commercial/types";

export type {
  CommercialInput,
  CommercialInputMode,
  CommercialResult,
} from "@/lib/domains/commercial/types";

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

export type AgencyFeeInput = {
  /** Client cost (revenue) in line currency. */
  revenue: number | null | undefined;
  /** Percent value 0..100 (e.g. 10 = 10%). */
  afPct?: number | null | undefined;
};

export type AgencyFeeResult = {
  afPct: number;
  afValue: number;
  /** GP Value + AF Value (total agency margin on the line). */
  agencyMargin: number;
};

/**
 * Agency Fee (AF) from client cost (revenue).
 * AF Value = Revenue × (AF% / 100); Agency Margin = GP Value + AF Value.
 */
export function computeAgencyFee(
  input: AgencyFeeInput & { gpValue?: number | null | undefined }
): AgencyFeeResult {
  const revenue = round2(toNumber(input.revenue));
  const afPct = round4(Math.max(0, toNumber(input.afPct)));
  const afValue = round2(revenue === 0 || afPct === 0 ? 0 : (revenue * afPct) / 100);
  const gpValue = round2(toNumber(input.gpValue));
  return {
    afPct,
    afValue,
    agencyMargin: round2(gpValue + afValue),
  };
}

export function computeCommercials(input: CommercialInput): CommercialResult {
  const cost = round2(toNumber(input.cost));

  if (cost < 0) {
    return { ...EMPTY, cost, warning: "Cost cannot be negative." };
  }

  switch (input.mode) {
    case "cost_markup_pct": {
      const markupPct = round4(toNumber(input.gpPct));
      if (markupPct < 0) {
        return { ...EMPTY, cost, gpPct: markupPct, warning: "Markup% cannot be negative." };
      }
      const revenue = round2(cost === 0 ? 0 : cost * (1 + markupPct / 100));
      const gpValue = round2(revenue - cost);
      const gpPct = revenue === 0 ? 0 : round4((gpValue / revenue) * 100);
      return { cost, revenue, gpPct, gpValue, valid: true, warning: null };
    }

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
