import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";

/** Resolve Full Description from quotation item + nested deliverables (export parity). */
export function resolveQuotationServiceDescription(input: {
  service_description?: string | null;
  deliverables?: QuotationDeliverable[] | null;
}): string | null {
  const fromDeliverables = (input.deliverables ?? [])
    .map((deliverable) => deliverable.service_description?.trim())
    .filter((value): value is string => Boolean(value));
  if (fromDeliverables.length > 0) {
    return [...new Set(fromDeliverables)].join(" · ");
  }
  const itemLevel = input.service_description?.trim();
  return itemLevel || null;
}
