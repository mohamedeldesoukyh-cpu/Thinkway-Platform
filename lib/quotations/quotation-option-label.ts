export type QuotationOptionLabel = "Additional Service" | "Deliverables";

export function normalizeQuotationOptionLabel(value: unknown): QuotationOptionLabel | null {
  return value === "Additional Service" || value === "Deliverables" ? value : null;
}

/** Presentation only: never changes option grouping, selection, or pricing. */
export function quotationOptionLabel(item: { option_label?: string | null; option_number?: number | null }, number = item.option_number): string {
  return normalizeQuotationOptionLabel(item.option_label) ??
    (number != null && number >= 1 ? `Option ${Math.floor(number)}` : "");
}
