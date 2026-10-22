import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { deliverableQuantity, withDeliverableCommercialPatch } from "./quotation-deliverable-commercial";
import { hasPricedDeliverables } from "./quotation-deliverable-rollup";

/** Null means legacy pricing rows have different quantities. */
export function quotationPackageRepeat(rows: QuotationDeliverable[]): number | null {
  const counts = new Set(rows.map(deliverableQuantity));
  return counts.size > 1 ? null : counts.values().next().value ?? 1;
}

export function repeatQuotationPackage<T extends QuotationDeliverable>(
  rows: T[], count: number,
  master: { cost: number; revenue: number; afPct: number; costCurrency: string; fxRateToEgp: number },
): T[] {
  const quantity = deliverableQuantity({ quantity: count });
  const priced = hasPricedDeliverables(rows);
  return rows.map((row, index) => {
    // Master-only prices must enter cost detail before a quantity edit can roll up.
    const source = !priced && index === 0 ? {
      ...row, cost: master.cost / deliverableQuantity(row), revenue: master.revenue,
      commercial_input_mode: "cost_revenue" as const,
      cost_currency: master.costCurrency, af_pct: master.afPct,
    } : row;
    return { ...row, ...withDeliverableCommercialPatch(source, { quantity }, master.fxRateToEgp) };
  });
}
