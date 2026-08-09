/**
 * Pure Commercial Workspace bulk transforms on QuotationRowDraft.
 * Stages into drafts only — Save goes through existing SSOT pipeline.
 */

import type { CommercialInputMode } from "@/lib/commercial/commercial-engine";
import { computeCommercials } from "@/lib/commercial/commercial-engine";

import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";

export type CommercialWorkspaceBulkOp =
  | { kind: "increase_revenue_pct"; pct: number }
  | { kind: "decrease_revenue_pct"; pct: number }
  | { kind: "increase_cost_pct"; pct: number }
  | { kind: "decrease_cost_pct"; pct: number }
  | { kind: "set_gp_pct"; pct: number }
  | { kind: "increase_gp_pct"; pct: number }
  | { kind: "decrease_gp_pct"; pct: number }
  | { kind: "apply_markup_pct"; pct: number }
  | { kind: "apply_discount_pct"; pct: number }
  | { kind: "set_currency"; currency: string; fxRateToEgp?: number }
  | { kind: "set_fx"; fxRateToEgp: number }
  | { kind: "set_af_pct"; pct: number };

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function applyFactor(value: number, factor: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * factor * 100) / 100;
}

function recomputeFromMode(draft: QuotationRowDraft): QuotationRowDraft {
  const computed = computeCommercials({
    mode: draft.mode,
    cost: draft.cost,
    gpPct: draft.gpPct,
    revenue: draft.revenue,
    gpValue: draft.gpValue,
  });
  return {
    ...draft,
    cost: computed.cost,
    revenue: computed.revenue,
    gpPct: computed.gpPct,
    gpValue: computed.gpValue,
  };
}

/**
 * Markup % → compute revenue from cost, then persist as cost_revenue.
 * Storing margin GP% under cost_markup_pct causes the next normalize to treat
 * margin as markup and rewrite revenue incorrectly.
 */
function withMarkup(draft: QuotationRowDraft, markupPct: number): QuotationRowDraft {
  const computed = recomputeFromMode({
    ...draft,
    mode: "cost_markup_pct" satisfies CommercialInputMode,
    gpPct: clampPct(markupPct),
  });
  return {
    ...computed,
    mode: "cost_revenue",
  };
}

/** Discount on revenue: reduce revenue by pct, keep cost, switch to cost_revenue. */
function withDiscount(draft: QuotationRowDraft, discountPct: number): QuotationRowDraft {
  const factor = 1 - clampPct(discountPct) / 100;
  const revenue = applyFactor(draft.revenue, factor);
  return recomputeFromMode({
    ...draft,
    mode: "cost_revenue",
    revenue,
  });
}

export function applyCommercialWorkspaceBulkOp(
  draft: QuotationRowDraft,
  op: CommercialWorkspaceBulkOp
): QuotationRowDraft {
  switch (op.kind) {
    case "increase_revenue_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_revenue",
        revenue: applyFactor(draft.revenue, 1 + clampPct(op.pct) / 100),
      });
    case "decrease_revenue_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_revenue",
        revenue: applyFactor(draft.revenue, 1 - clampPct(op.pct) / 100),
      });
    case "increase_cost_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_revenue",
        cost: applyFactor(draft.cost, 1 + clampPct(op.pct) / 100),
      });
    case "decrease_cost_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_revenue",
        cost: applyFactor(draft.cost, 1 - clampPct(op.pct) / 100),
      });
    case "set_gp_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_gp_pct",
        gpPct: clampPct(op.pct),
      });
    case "increase_gp_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_gp_pct",
        gpPct: clampPct(draft.gpPct + clampPct(op.pct)),
      });
    case "decrease_gp_pct":
      return recomputeFromMode({
        ...draft,
        mode: "cost_gp_pct",
        gpPct: clampPct(draft.gpPct - clampPct(op.pct)),
      });
    case "apply_markup_pct":
      return withMarkup(draft, op.pct);
    case "apply_discount_pct":
      return withDiscount(draft, op.pct);
    case "set_currency":
      return {
        ...draft,
        costCurrency: op.currency.toUpperCase(),
        fxRateToEgp:
          op.fxRateToEgp ??
          (op.currency.toUpperCase() === "EGP" ? 1 : draft.fxRateToEgp),
      };
    case "set_fx":
      return {
        ...draft,
        fxRateToEgp: Math.max(0, Number.isFinite(op.fxRateToEgp) ? op.fxRateToEgp : 0),
      };
    case "set_af_pct":
      return recomputeFromMode({
        ...draft,
        afPct: clampPct(op.pct),
      });
  }
}

export function applyCommercialWorkspaceBulkOpToDrafts(
  drafts: Record<string, QuotationRowDraft | undefined>,
  itemIds: string[],
  op: CommercialWorkspaceBulkOp
): Record<string, QuotationRowDraft> {
  const next: Record<string, QuotationRowDraft> = {};
  for (const id of itemIds) {
    const draft = drafts[id];
    if (!draft) continue;
    next[id] = applyCommercialWorkspaceBulkOp(draft, op);
  }
  return next;
}
