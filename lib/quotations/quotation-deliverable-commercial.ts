import { computeCommercials, type CommercialInputMode } from "@/lib/commercial/commercial-engine";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { deliverableLineCost } from "@/lib/quotations/quotation-deliverable-rollup";

/** Default calculation mode for quotation deliverable cost details (not line-level commercial). */
export const QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE: CommercialInputMode =
  "cost_markup_pct";

export function deliverableCommercialDefaults(
  item: QuotationItemRow
): Pick<
  QuotationDeliverable,
  "commercial_input_mode" | "cost_currency" | "gp_pct" | "af_pct" | "cost" | "gp_value"
> {
  return {
    commercial_input_mode: QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE,
    cost_currency: item.cost_currency || "EGP",
    gp_pct: item.gp_pct,
    af_pct: item.af_pct,
    cost: 0,
    gp_value: 0,
  };
}

/** Integer units for this pricing line (min 1). */
export function deliverableQuantity(deliverable: { quantity?: number | null }): number {
  const n = Math.floor(Number(deliverable.quantity) || 1);
  return n > 0 ? n : 1;
}

/** Client price (line currency) from deliverable cost-detail fields. */
export function computeDeliverableClientPrice(
  deliverable: QuotationDeliverable,
  _fxRateToEgp = 1
): number {
  const qty = deliverableQuantity(deliverable);
  const mode =
    deliverable.commercial_input_mode ?? QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE;
  const unitCost = deliverable.cost ?? 0;

  if (mode === "cost_revenue") {
    const revenue = Number(deliverable.revenue ?? 0);
    return revenue > 0 ? revenue : 0;
  }

  const line = computeCommercials({
    mode,
    cost: unitCost * qty,
    gpPct: deliverable.gp_pct,
    revenue: deliverable.revenue,
    gpValue:
      deliverable.gp_value != null && deliverable.gp_value !== 0
        ? (deliverable.gp_value ?? 0) * qty
        : deliverable.gp_value,
  });
  return line.revenue;
}

export function withDeliverableCommercialPatch(
  deliverable: QuotationDeliverable,
  patch: Partial<QuotationDeliverable>,
  fxRateToEgp: number
): QuotationDeliverable {
  const merged: QuotationDeliverable = { ...deliverable, ...patch };
  const revenue = computeDeliverableClientPrice(merged, fxRateToEgp);
  return { ...merged, revenue: revenue > 0 ? revenue : null };
}

export function formatDeliverablePrice(
  revenue: number | null | undefined,
  currency: string
): string {
  if (revenue == null || revenue <= 0) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(revenue)} ${currency}`;
}

/** Blended GP% for one deliverable pricing row (margin on client cost). */
export function computeDeliverableGpMetrics(
  deliverable: QuotationDeliverable,
  fxRateToEgp = 1
) {
  const cost = deliverableLineCost(deliverable);
  const revenue = computeDeliverableClientPrice(deliverable, fxRateToEgp);
  return computeCommercials({ mode: "cost_revenue", cost, revenue });
}

export function formatDeliverableGpPct(
  deliverable: QuotationDeliverable,
  fxRateToEgp = 1
): string | null {
  const metrics = computeDeliverableGpMetrics(deliverable, fxRateToEgp);
  if (metrics.revenue <= 0) return null;
  return `${metrics.gpPct.toFixed(1)}%`;
}
