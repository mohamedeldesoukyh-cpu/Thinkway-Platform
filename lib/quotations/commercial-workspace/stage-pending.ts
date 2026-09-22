import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { deliverablesPatchForLineMasterSave } from "@/lib/quotations/quotation-line-commercial-ssot";

/**
 * Map a shared Commercial Workspace draft into the quotation save pending payload.
 *
 * When existing deliverables are provided, strip their commercial amounts so a
 * prior Cost Detail pending merge cannot resurrect stale prices after a Master edit.
 */
export function draftToLinePending(
  draft: QuotationRowDraft,
  existingDeliverables?: QuotationDeliverable[] | null
): QuotationLinePendingPayload {
  const stripped = deliverablesPatchForLineMasterSave(existingDeliverables);
  return {
    mode: draft.mode,
    cost: draft.cost,
    cost_currency: draft.costCurrency,
    cost_fx_override: draft.costFxOverride ?? null,
    revenue_fx_override: draft.revenueFxOverride ?? null,
    revenue: draft.revenue,
    gp_pct: draft.gpPct,
    gp_value: draft.gpValue,
    af_pct: draft.afPct,
    ...(stripped ? { deliverables: stripped } : {}),
  };
}
