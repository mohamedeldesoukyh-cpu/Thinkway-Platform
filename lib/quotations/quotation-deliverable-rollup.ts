import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { computeCommercials } from "@/lib/commercial/commercial-engine";

import {
  computeDeliverableClientPrice,
  deliverableQuantity,
} from "@/lib/quotations/quotation-deliverable-commercial";

export type DeliverableCommercialRollup = {
  cost: number;
  revenue: number;
  gpValue: number;
  gpPct: number;
};

export type DeliverableRollupOptions = {
  lineCurrency: string;
  fxRateToEgp: number;
};

function fxRateForCurrency(currency: string, options: DeliverableRollupOptions): number {
  const normalized = (currency || options.lineCurrency || "EGP").toUpperCase();
  if (normalized === "EGP") return 1;
  return options.fxRateToEgp > 0 ? options.fxRateToEgp : 1;
}

function lineCurrencyRate(options: DeliverableRollupOptions): number {
  return fxRateForCurrency(options.lineCurrency, options);
}

/** Unit cost × pricing quantity for one deliverable row. */
export function deliverableLineCost(deliverable: QuotationDeliverable): number {
  const qty = deliverableQuantity(deliverable);
  const unitCost = Number(deliverable.cost ?? 0);
  return Number.isFinite(unitCost) && unitCost > 0 ? unitCost * qty : 0;
}

/** True when at least one deliverable has cost-detail pricing entered. */
export function hasPricedDeliverables(
  deliverables: QuotationDeliverable[] | null | undefined
): boolean {
  if (!deliverables?.length) return false;
  return deliverables.some((d) => {
    if (deliverableLineCost(d) > 0) return true;
    const clientPrice = Number(d.revenue ?? 0);
    return Number.isFinite(clientPrice) && clientPrice > 0;
  });
}

/** Sum deliverable cost, client price, and blended GP% in the quotation line currency. */
export function rollupDeliverableCommercials(
  deliverables: QuotationDeliverable[],
  options: DeliverableRollupOptions
): DeliverableCommercialRollup | null {
  if (!hasPricedDeliverables(deliverables)) return null;

  const targetRate = lineCurrencyRate(options);
  let costEgp = 0;
  let revenueEgp = 0;

  for (const deliverable of deliverables) {
    const currency = (deliverable.cost_currency || options.lineCurrency || "EGP").toUpperCase();
    const rate = fxRateForCurrency(currency, options);
    costEgp += deliverableLineCost(deliverable) * rate;
    revenueEgp += computeDeliverableClientPrice(deliverable, rate) * rate;
  }

  const cost = targetRate === 1 ? costEgp : costEgp / targetRate;
  const revenue = targetRate === 1 ? revenueEgp : revenueEgp / targetRate;
  const line = computeCommercials({ mode: "cost_revenue", cost, revenue });

  return {
    cost: line.cost,
    revenue: line.revenue,
    gpValue: line.gpValue,
    gpPct: line.gpPct,
  };
}

/** Sum deliverable cost and client price in EGP (for header totals). */
export function rollupDeliverableCommercialsEgp(
  deliverables: QuotationDeliverable[],
  options: DeliverableRollupOptions
): { costEgp: number; revenueEgp: number; gpValueEgp: number; gpPct: number } | null {
  const rolled = rollupDeliverableCommercials(deliverables, options);
  if (!rolled) return null;
  const rate = lineCurrencyRate(options);
  const costEgp = rolled.cost * rate;
  const revenueEgp = rolled.revenue * rate;
  return {
    costEgp,
    revenueEgp,
    gpValueEgp: revenueEgp - costEgp,
    gpPct: rolled.gpPct,
  };
}
