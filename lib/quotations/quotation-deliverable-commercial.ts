import {
  computeAgencyFee,
  computeCommercials,
  type CommercialInputMode,
} from "@/lib/commercial/commercial-engine";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { deliverableLineCost } from "@/lib/quotations/quotation-deliverable-rollup";

/** Default calculation mode for quotation deliverable cost details (not line-level commercial). */
export const QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE: CommercialInputMode =
  "cost_markup_pct";

function itemHasPricedDeliverables(
  deliverables: QuotationItemRow["deliverables"] | null | undefined
): boolean {
  if (!deliverables?.length) return false;
  return deliverables.some((d) => {
    if (d.free_for_client === true) return true;
    if ((Number(d.cost) || 0) > 0) return true;
    return (Number(d.revenue) || 0) > 0;
  });
}

export function deliverableCommercialDefaults(
  item: QuotationItemRow
): Pick<
  QuotationDeliverable,
  | "commercial_input_mode"
  | "cost_currency"
  | "gp_pct"
  | "af_pct"
  | "cost"
  | "gp_value"
  | "revenue"
> {
  const hasMaster =
    (Number(item.cost) > 0 || Number(item.revenue) > 0) &&
    !itemHasPricedDeliverables(item.deliverables);
  return {
    commercial_input_mode: hasMaster
      ? item.commercial_input_mode || QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE
      : QUOTATION_DELIVERABLE_DEFAULT_COMMERCIAL_MODE,
    cost_currency: item.cost_currency || "EGP",
    gp_pct: item.gp_pct,
    af_pct: item.af_pct,
    // Seed Cost Detail from line Master when deliverables were cleared by CW save.
    cost: hasMaster ? Number(item.cost) || 0 : 0,
    revenue: hasMaster ? Number(item.revenue) || 0 : undefined,
    gp_value: hasMaster ? Number(item.gp_value) || 0 : 0,
  };
}

/** Integer units for this pricing line (min 1). */
export function deliverableQuantity(deliverable: { quantity?: number | null }): number {
  const n = Math.floor(Number(deliverable.quantity) || 1);
  return n > 0 ? n : 1;
}

export function isDeliverableFreeForClient(
  deliverable: Pick<QuotationDeliverable, "free_for_client"> | null | undefined
): boolean {
  return deliverable?.free_for_client === true;
}

export function resolveDeliverableAfPct(
  deliverable: QuotationDeliverable,
  fallbackAfPct?: number | null
): number {
  const afPct = deliverable.af_pct ?? fallbackAfPct ?? 0;
  return Number.isFinite(afPct) ? Math.max(0, afPct) : 0;
}

/** Base client cost (line currency) before agency fee. */
export function computeDeliverableClientPrice(
  deliverable: QuotationDeliverable,
  _fxRateToEgp = 1
): number {
  if (isDeliverableFreeForClient(deliverable)) return 0;

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

/** Agency fee amount for one deliverable row (AF% × base client cost). */
export function computeDeliverableAgencyFee(
  deliverable: QuotationDeliverable,
  fxRateToEgp = 1,
  fallbackAfPct?: number | null
) {
  const revenue = computeDeliverableClientPrice(deliverable, fxRateToEgp);
  return computeAgencyFee({
    revenue,
    afPct: resolveDeliverableAfPct(deliverable, fallbackAfPct),
  });
}

/** Total client cost including agency fee. */
export function computeDeliverableTotalClientCost(
  deliverable: QuotationDeliverable,
  fxRateToEgp = 1,
  fallbackAfPct?: number | null
): number {
  if (isDeliverableFreeForClient(deliverable)) return 0;
  const revenue = computeDeliverableClientPrice(deliverable, fxRateToEgp);
  const { afValue } = computeDeliverableAgencyFee(deliverable, fxRateToEgp, fallbackAfPct);
  return revenue + afValue;
}

export function withDeliverableCommercialPatch(
  deliverable: QuotationDeliverable,
  patch: Partial<QuotationDeliverable>,
  fxRateToEgp: number
): QuotationDeliverable {
  const merged: QuotationDeliverable = { ...deliverable, ...patch };
  const freeForClient = isDeliverableFreeForClient(merged);
  const revenue = computeDeliverableClientPrice(merged, fxRateToEgp);
  return {
    ...merged,
    free_for_client: freeForClient ? true : false,
    revenue: freeForClient ? 0 : revenue > 0 ? revenue : null,
  };
}

export function formatDeliverablePrice(
  revenue: number | null | undefined,
  currency: string,
  options?: { freeForClient?: boolean }
): string {
  if (options?.freeForClient) return "Free";
  if (revenue == null || revenue <= 0) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(revenue)} ${currency}`;
}

export function formatDeliverableTotalClientPrice(
  deliverable: QuotationDeliverable,
  currency: string,
  fxRateToEgp = 1,
  options?: { freeForClient?: boolean; fallbackAfPct?: number | null }
): string {
  if (options?.freeForClient || deliverable.free_for_client === true) return "Free";
  const total = computeDeliverableTotalClientCost(
    deliverable,
    fxRateToEgp,
    options?.fallbackAfPct
  );
  return formatDeliverablePrice(total, currency);
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
