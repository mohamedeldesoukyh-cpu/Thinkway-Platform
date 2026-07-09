/**
 * Pure quotation row + live totals math (no UI, no DB).
 * Used by the quotation workspace for instant header/footer totals that
 * always match the visible row values.
 */
import {
  computeAgencyFee,
  computeCommercials,
  type CommercialInputMode,
} from "@/lib/commercial/commercial-engine";
import type { CommercialTotals } from "@/lib/commercial/fx-aggregation";
import { toEgp } from "@/lib/commercial/fx-aggregation";
import { computeQuotationTotals } from "@/features/quotations/quotation-engine";
import type { QuotationItemRow } from "@/features/quotations/types";
import {
  rollupDeliverableCommercials,
} from "@/lib/quotations/quotation-deliverable-rollup";

export type QuotationRowDraft = {
  id: string;
  mode: CommercialInputMode;
  cost: number;
  costCurrency: string;
  gpPct: number;
  revenue: number;
  gpValue: number;
  afPct: number;
  fxRateToEgp: number;
};

export type QuotationRowComputed = {
  costEgp: number;
  revenueEgp: number;
  gpValueEgp: number;
  gpPct: number;
  revenue: number;
  gpValue: number;
  afPct: number;
  afValue: number;
  afValueEgp: number;
  agencyMargin: number;
  agencyMarginEgp: number;
  valid: boolean;
  warning: string | null;
};

export type CalculationModePreference = "markup" | "margin";

export function calcModeToCommercialMode(
  pref: CalculationModePreference
): CommercialInputMode {
  return pref === "markup" ? "cost_markup_pct" : "cost_gp_pct";
}

export function draftFromQuotationItem(item: QuotationItemRow): QuotationRowDraft {
  const costCurrency = item.cost_currency || "EGP";
  const base: QuotationRowDraft = {
    id: item.id,
    mode: item.commercial_input_mode,
    cost: item.cost,
    costCurrency,
    gpPct: item.gp_pct,
    revenue: item.revenue,
    gpValue: item.gp_value,
    afPct: item.af_pct,
    fxRateToEgp: item.fx_rate_to_egp,
  };

  const rolled = rollupDeliverableCommercials(item.deliverables ?? [], {
    lineCurrency: costCurrency,
    fxRateToEgp: item.fx_rate_to_egp,
  });
  if (!rolled) return base;

  return {
    ...base,
    mode: "cost_revenue",
    cost: rolled.cost,
    revenue: rolled.revenue,
    gpPct: rolled.gpPct,
    gpValue: rolled.gpValue,
  };
}

/** Prefer live draft edits, then deliverable rollup, then stored item commercials. */
export function resolveQuotationRowDraft(
  item: QuotationItemRow,
  draft?: QuotationRowDraft
): QuotationRowDraft {
  const base = draft ?? draftFromQuotationItem(item);

  if (base.mode === "cost_revenue" && (base.cost > 0 || base.revenue > 0)) {
    return base;
  }

  const rolled = rollupDeliverableCommercials(item.deliverables ?? [], {
    lineCurrency: base.costCurrency,
    fxRateToEgp: base.fxRateToEgp,
  });
  if (!rolled) return base;

  return {
    ...base,
    mode: "cost_revenue",
    cost: rolled.cost,
    revenue: rolled.revenue,
    gpPct: rolled.gpPct,
    gpValue: rolled.gpValue,
  };
}

export function draftsFromItems(items: QuotationItemRow[]): Record<string, QuotationRowDraft> {
  return Object.fromEntries(items.map((item) => [item.id, draftFromQuotationItem(item)]));
}

/** Resolve FX rate for a row draft (EGP always 1). */
export function effectiveFxRate(draft: QuotationRowDraft): number {
  if (draft.costCurrency === "EGP") return 1;
  return draft.fxRateToEgp > 0 ? draft.fxRateToEgp : 1;
}

/** Compute row commercials + EGP values from a live draft (matches row display). */
export function computeQuotationRowComputed(draft: QuotationRowDraft): QuotationRowComputed {
  const r = computeCommercials({
    mode: draft.mode,
    cost: draft.cost,
    gpPct: draft.gpPct,
    revenue: draft.revenue,
    gpValue: draft.gpValue,
  });
  const af = computeAgencyFee({
    revenue: r.revenue,
    afPct: draft.afPct,
    gpValue: r.gpValue,
  });
  const rate = effectiveFxRate(draft);
  const afValueEgp = toEgp(af.afValue, rate);
  const agencyMarginEgp = toEgp(af.agencyMargin, rate);
  return {
    costEgp: toEgp(r.cost, rate),
    revenueEgp: toEgp(r.revenue, rate),
    gpValueEgp: toEgp(r.gpValue, rate),
    gpPct: r.gpPct,
    revenue: r.revenue,
    gpValue: r.gpValue,
    afPct: af.afPct,
    afValue: af.afValue,
    afValueEgp,
    agencyMargin: af.agencyMargin,
    agencyMarginEgp,
    valid: r.valid,
    warning: r.warning,
  };
}

/** Aggregate live row drafts into header/footer totals (EGP). */
export function computeLiveQuotationTotals(
  drafts: QuotationRowDraft[]
): CommercialTotals {
  const lines = drafts.map((draft) => {
    const row = computeQuotationRowComputed(draft);
    return {
      cost_egp: row.costEgp,
      revenue_egp: row.revenueEgp,
      gp_value_egp: row.gpValueEgp,
      af_value_egp: row.afValueEgp,
    };
  });
  return computeQuotationTotals(lines);
}

export function aggregateAutosaveStatus(
  statuses: Array<"idle" | "pending" | "saving" | "saved" | "error">
): "idle" | "pending" | "saving" | "saved" | "error" {
  if (statuses.some((s) => s === "error")) return "error";
  if (statuses.some((s) => s === "saving")) return "saving";
  if (statuses.some((s) => s === "pending")) return "pending";
  if (statuses.some((s) => s === "saved")) return "saved";
  return "idle";
}
