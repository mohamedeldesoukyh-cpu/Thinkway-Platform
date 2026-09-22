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
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { computeQuotationTotals } from "@/features/quotations/quotation-engine";
import type { QuotationItemRow } from "@/features/quotations/types";

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
  costFxOverride?: string | null;
  revenueFxOverride?: string | null;
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

/**
 * Build a row draft from persisted quotation line Master columns.
 *
 * Commercial SSOT (COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md): Master facts live on the
 * line (`cost` / `revenue` / GP / AF). Do not rebuild from deliverable rollups —
 * Cost Detail must roll up into the line on save; line Save clears stale
 * deliverable commercials so remount cannot resurrect old totals.
 */
export function draftFromQuotationItem(item: QuotationItemRow): QuotationRowDraft {
  return {
    id: item.id,
    mode: item.commercial_input_mode,
    cost: item.cost,
    costCurrency: item.cost_currency || "EGP",
    gpPct: item.gp_pct,
    revenue: item.revenue,
    gpValue: item.gp_value,
    afPct: item.af_pct,
    fxRateToEgp: item.fx_rate_to_egp,
    costFxOverride: item.cost_fx_override ?? null,
    revenueFxOverride: item.revenue_fx_override ?? null,
  };
}

/**
 * Prefer live draft edits; otherwise line Master from the persisted item.
 * Deliverable rollups must never override Master on remount.
 */
export function resolveQuotationRowDraft(
  item: QuotationItemRow,
  draft?: QuotationRowDraft
): QuotationRowDraft {
  if (draft) return draft;
  return draftFromQuotationItem(item);
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
  const conversion = { from: draft.costCurrency, to: "EGP", sourceRateToEgp: rate, targetRateToEgp: 1 };
  const costEgp = creatorFxAmount(r.cost, { ...conversion, override: draft.costFxOverride });
  const revenueEgp = creatorFxAmount(r.revenue, { ...conversion, override: draft.revenueFxOverride });
  const afValueEgp = creatorFxAmount(af.afValue, { ...conversion, override: draft.revenueFxOverride });
  const agencyMarginEgp = roundMoney(revenueEgp - costEgp + afValueEgp);
  return {
    costEgp,
    revenueEgp,
    gpValueEgp: roundMoney(revenueEgp - costEgp),
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

/** Client-facing row amounts, including agency fees, matching quotation totals. */
export function computeQuotationRowClientCommercials(draft: QuotationRowDraft) {
  const row = computeQuotationRowComputed(draft);
  const clientCost = roundMoney(row.revenue + row.afValue);
  const clientCostEgp = roundMoney(row.revenueEgp + row.afValueEgp);
  return {
    clientCost,
    clientCostEgp,
    agencyFeeEgp: row.afValueEgp,
    marginEgp: row.agencyMarginEgp,
    marginPct: clientCostEgp > 0 ? (row.agencyMarginEgp / clientCostEgp) * 100 : 0,
  };
}

/** Display projections use each negotiated pair directly, including an EGP original shown in USD. */
export function computeQuotationDisplayTotals(drafts: QuotationRowDraft[], currency: string, rateToEgp: number) {
  const totals = drafts.reduce((sum, draft) => {
    const row = computeQuotationRowComputed(draft);
    const conversion = { from: draft.costCurrency, to: currency, sourceRateToEgp: draft.fxRateToEgp, targetRateToEgp: rateToEgp };
    sum.cost += creatorFxAmount(draft.cost, { ...conversion, override: draft.costFxOverride });
    sum.revenue += creatorFxAmount(row.revenue, { ...conversion, override: draft.revenueFxOverride });
    sum.af += creatorFxAmount(row.afValue, { ...conversion, override: draft.revenueFxOverride });
    return sum;
  }, { cost: 0, revenue: 0, af: 0 });
  const cost = roundMoney(totals.cost), revenue = roundMoney(totals.revenue), af = roundMoney(totals.af);
  const clientCost = roundMoney(revenue + af), gp = roundMoney(revenue - cost), margin = roundMoney(clientCost - cost);
  return { cost, revenue, af, clientCost, gp, margin, marginPct: clientCost ? margin / clientCost * 100 : 0, markupPct: cost ? margin / cost * 100 : 0 };
}

export type QuotationHeaderCommercialTotals = CommercialTotals & {
  /** Client cost including agency fee (base revenue + AF). */
  totalClientCostEgp: number;
  /** Agency margin for header display (GP + AF). */
  headerGpValueEgp: number;
  headerGpPct: number;
  headerPmPct: number;
};

/** Map stored/live totals to header metrics that include agency fees in client cost. */
export function resolveQuotationHeaderCommercialTotals(
  totals: CommercialTotals
): QuotationHeaderCommercialTotals {
  const totalClientCostEgp = Math.round((totals.totalRevenueEgp + totals.totalAfValueEgp + Number.EPSILON) * 100) / 100;
  const headerGpValueEgp = totals.totalAgencyMarginEgp;
  const headerGpPct =
    totalClientCostEgp === 0
      ? 0
      : Math.round(((headerGpValueEgp / totalClientCostEgp) * 100 + Number.EPSILON) * 10000) / 10000;
  const headerPmPct =
    totals.totalCostEgp === 0
      ? 0
      : Math.round(((headerGpValueEgp / totals.totalCostEgp) * 100 + Number.EPSILON) * 10000) / 10000;

  return {
    ...totals,
    totalClientCostEgp,
    headerGpValueEgp,
    headerGpPct,
    headerPmPct,
  };
}

export type OriginalCurrencyTotals = {
  currency: string;
  totalCost: number;
  totalClientCost: number;
  totalGpMargin: number;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Native-currency totals for header display (line cost currency, not converted EGP). */
export function aggregateOriginalCurrencyTotals(
  drafts: QuotationRowDraft[]
): OriginalCurrencyTotals[] {
  const byCurrency = new Map<string, OriginalCurrencyTotals>();

  for (const draft of drafts) {
    const currency = (draft.costCurrency || "EGP").trim().toUpperCase() || "EGP";
    const row = computeQuotationRowComputed(draft);
    const existing = byCurrency.get(currency) ?? {
      currency,
      totalCost: 0,
      totalClientCost: 0,
      totalGpMargin: 0,
    };
    existing.totalCost = roundMoney(existing.totalCost + draft.cost);
    existing.totalClientCost = roundMoney(existing.totalClientCost + row.revenue + row.afValue);
    existing.totalGpMargin = roundMoney(existing.totalGpMargin + row.agencyMargin);
    byCurrency.set(currency, existing);
  }

  return [...byCurrency.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

/** Original amounts that differ from the header display currency (e.g. SAR under EGP). */
export function originalCurrencyTotalsForDisplay(
  drafts: QuotationRowDraft[],
  displayCurrency: string
): OriginalCurrencyTotals[] {
  const display = (displayCurrency || "EGP").trim().toUpperCase() || "EGP";
  return aggregateOriginalCurrencyTotals(drafts).filter((row) => row.currency !== display);
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
