import { QUOTATION_POST_TYPES, normalizeQuotationPostType, normalizeTypeLineQuantity } from "@/lib/quotations/quotation-deliverable-types";
import type { QuotationDeliverableTypeLine } from "@/lib/domains/commercial/quotation-types";

export type DeliverableFavorite = { id: string; name: string; description: string; lines: QuotationDeliverableTypeLine[] };

export function validateDeliverableFavorites(input: unknown): DeliverableFavorite[] {
  if (!Array.isArray(input) || input.length > 30) throw new Error("You can save up to 30 favorites.");
  const ids = new Set<string>();
  return input.map(value => {
    if (!value || typeof value !== "object") throw new Error("Invalid favorite.");
    const { id, name, description, lines } = value;
    if (typeof id !== "string" || !/^[a-zA-Z0-9-]{1,64}$/.test(id) || ids.has(id)) throw new Error("Invalid favorite ID.");
    ids.add(id);
    if (typeof name !== "string" || !name.trim() || name.length > 80) throw new Error("Give the favorite a name of up to 80 characters.");
    if (typeof description !== "string" || description.length > 2000) throw new Error("Service description is too long.");
    if (!Array.isArray(lines) || !lines.length || lines.length > 50) throw new Error("Select at least one deliverable.");
    const types = new Set<string>();
    return { id, name: name.trim(), description: description.trim(), lines: lines.map(line => {
      const type = normalizeQuotationPostType(String(line?.type ?? ""));
      if (!QUOTATION_POST_TYPES.some(entry => entry.value === type) || types.has(type)) throw new Error("Select valid, unique deliverable types.");
      types.add(type);
      const quantity = normalizeTypeLineQuantity(line.quantity);
      if (quantity > 10000) throw new Error("Deliverable quantity is too large.");
      const period = line.period_months == null ? null : Number(line.period_months);
      if (period != null && (!Number.isInteger(period) || period < 1 || period > 120)) throw new Error("Duration must be 1–120 months.");
      return { type, quantity, period_months: period };
    }) };
  });
}
