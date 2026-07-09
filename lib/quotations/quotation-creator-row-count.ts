import type { QuotationItemRow } from "@/features/quotations/types";
import { deliverableTypeLines } from "@/lib/quotations/quotation-deliverable-types";

/** Visible pricing rows for one quotation option line (min 1). */
export function countQuotationItemDeliverableRows(item: QuotationItemRow): number {
  const deliverables = item.deliverables ?? [];
  const priced = deliverables.filter((d) => {
    const lines = deliverableTypeLines(d).filter((line) => line.type.trim());
    return (
      d.type?.trim() ||
      (d.types?.length ?? 0) > 0 ||
      lines.length > 0
    );
  });
  return Math.max(1, priced.length > 0 ? priced.length : deliverables.length);
}

export function countQuotationCreatorGroupRows(items: QuotationItemRow[]): number {
  return items.reduce((sum, item) => sum + countQuotationItemDeliverableRows(item), 0);
}
