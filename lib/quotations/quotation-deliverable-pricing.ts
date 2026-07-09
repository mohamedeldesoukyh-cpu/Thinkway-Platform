import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";

/** Total client price for one post-type line (not unit price — full line total). */
export function deliverableClientPrice(deliverable: QuotationDeliverable): number {
  const total = Number(deliverable.revenue ?? 0);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return total;
}

export function sumDeliverableClientPrice(deliverables: QuotationDeliverable[]): number {
  return deliverables.reduce((sum, d) => sum + deliverableClientPrice(d), 0);
}
