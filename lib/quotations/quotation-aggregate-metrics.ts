import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import { quotationCreatorDuplicateKey } from "./quotation-creator-options";

export function aggregateQuotationReach(items: QuotationItemRow[]): number {
  return items.reduce((sum, item) => sum + (item.followers ?? 0), 0);
}

/** Average ER across unique creators — one value per creator, not per option line. */
export function aggregateQuotationEngagementRate(
  items: QuotationItemRow[]
): number | null {
  const byCreator = new Map<string, number>();
  for (const item of items) {
    if (item.engagement_rate == null || !Number.isFinite(item.engagement_rate)) continue;
    const key = quotationCreatorDuplicateKey(item);
    if (!byCreator.has(key)) {
      byCreator.set(key, Number(item.engagement_rate));
    }
  }
  if (!byCreator.size) return null;
  const total = [...byCreator.values()].reduce((sum, rate) => sum + rate, 0);
  return total / byCreator.size;
}
