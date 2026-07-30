import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";

/** Map a shared draft into the quotation save pending payload (SSOT pipeline). */
export function draftToLinePending(draft: QuotationRowDraft): QuotationLinePendingPayload {
  return {
    mode: draft.mode,
    cost: draft.cost,
    cost_currency: draft.costCurrency,
    revenue: draft.revenue,
    gp_pct: draft.gpPct,
    gp_value: draft.gpValue,
    af_pct: draft.afPct,
  };
}
