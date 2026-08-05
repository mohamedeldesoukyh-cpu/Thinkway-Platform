/**
 * Quotation commercial SSOT helpers.
 *
 * Authority (COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md):
 * - Master commercial facts live on the **quotation line** (`quotation_items` columns).
 * - Deliverable rows may carry Cost Detail breakdowns; they must never silently
 *   override Master after a line-level Save (Commercial Workspace / bulk).
 *
 * When Cost Detail saves deliverables, rollup writes Master onto the line in the
 * same update. When Master is edited without deliverables, strip deliverable
 * commercial amounts in that same update so remount/rebuild cannot revive stale
 * rollups.
 */

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { hasPricedDeliverables } from "@/lib/quotations/quotation-deliverable-rollup";

/** Strip Master commercial amounts from deliverable rows; keep type/qty/platform. */
export function stripDeliverableCommercialAmounts(
  deliverables: QuotationDeliverable[]
): QuotationDeliverable[] {
  return deliverables.map((deliverable) => ({
    ...deliverable,
    cost: null,
    revenue: null,
    gp_pct: null,
    gp_value: null,
    af_pct: null,
    commercial_input_mode: undefined,
    free_for_client: false,
    cost_currency: deliverable.cost_currency ?? null,
  }));
}

/**
 * When a line-Master save omits deliverables, return stripped deliverables so the
 * same DB UPDATE clears stale Cost Detail amounts. Returns null when no change.
 */
export function deliverablesPatchForLineMasterSave(
  existingDeliverables: QuotationDeliverable[] | null | undefined
): QuotationDeliverable[] | null {
  const list = existingDeliverables ?? [];
  if (!hasPricedDeliverables(list)) return null;
  return stripDeliverableCommercialAmounts(list);
}
