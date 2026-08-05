/**
 * Keep Commercial Workspace (line Master) and creator-line Cost Detail / Price
 * visually and pending-state aligned.
 *
 * Master remains SSOT. When Master is edited, deliverable commercials are
 * projected onto the first pricing row (others cleared) so Price + Cost Detail
 * show the same numbers. When Cost Detail rolls up, Master draft is updated by
 * the existing deliverable rollup path.
 */

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import {
  formatDeliverablePrice,
  formatDeliverableTotalClientPrice,
} from "@/lib/quotations/quotation-deliverable-commercial";
import {
  hasPricedDeliverables,
  rollupDeliverableCommercials,
} from "@/lib/quotations/quotation-deliverable-rollup";
import { stripDeliverableCommercialAmounts } from "@/lib/quotations/quotation-line-commercial-ssot";

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

/** True when deliverable rollup already matches the line Master draft. */
export function deliverablesMatchLineDraft(
  deliverables: QuotationDeliverable[],
  draft: QuotationRowDraft
): boolean {
  if (!hasPricedDeliverables(deliverables)) {
    return draft.cost <= 0 && draft.revenue <= 0;
  }
  const rolled = rollupDeliverableCommercials(deliverables, {
    lineCurrency: draft.costCurrency || "EGP",
    fxRateToEgp: draft.fxRateToEgp > 0 ? draft.fxRateToEgp : 1,
    lineAfPct: draft.afPct,
  });
  if (!rolled) return draft.cost <= 0 && draft.revenue <= 0;
  return (
    nearlyEqual(rolled.cost, draft.cost) &&
    nearlyEqual(rolled.revenue, draft.revenue) &&
    nearlyEqual(rolled.gpPct, draft.gpPct) &&
    nearlyEqual(rolled.afPct, draft.afPct)
  );
}

/**
 * Project line Master commercials onto deliverable rows for live UI sync.
 * First row receives Master amounts; remaining rows keep type/qty/platform only.
 */
export function projectLineDraftOntoDeliverables(
  deliverables: QuotationDeliverable[],
  draft: QuotationRowDraft
): QuotationDeliverable[] {
  const list =
    deliverables.length > 0
      ? deliverables
      : [
          {
            platform: "instagram",
            type: "ig_reel",
            quantity: 1,
            cost: null,
            revenue: null,
            gp_pct: null,
            gp_value: null,
            af_pct: null,
            cost_currency: draft.costCurrency || "EGP",
          } satisfies QuotationDeliverable,
        ];

  const cleared = stripDeliverableCommercialAmounts(list);
  if (draft.cost <= 0 && draft.revenue <= 0) return cleared;

  return cleared.map((deliverable, index) => {
    if (index !== 0) return deliverable;
    return {
      ...deliverable,
      commercial_input_mode: draft.mode,
      cost: draft.cost,
      revenue: draft.revenue,
      gp_pct: draft.gpPct,
      gp_value: draft.gpValue,
      af_pct: draft.afPct,
      cost_currency: draft.costCurrency || deliverable.cost_currency || "EGP",
      free_for_client: false,
    };
  });
}

/** Client price label for a creator pricing row (deliverable, else line Master). */
export function resolveCreatorLinePriceLabel(
  deliverable: QuotationDeliverable,
  draft: QuotationRowDraft | undefined,
  options?: {
    currency?: string;
    fxRateToEgp?: number;
    fallbackAfPct?: number | null;
    /** When true, this row may show the full line Master total as fallback. */
    allowLineMasterFallback?: boolean;
  }
): string {
  const currency =
    options?.currency ||
    deliverable.cost_currency ||
    draft?.costCurrency ||
    "EGP";
  const fx = options?.fxRateToEgp ?? draft?.fxRateToEgp ?? 1;
  const fromDeliverable = formatDeliverableTotalClientPrice(deliverable, currency, fx, {
    freeForClient: deliverable.free_for_client === true,
    fallbackAfPct: options?.fallbackAfPct ?? draft?.afPct,
  });
  if (fromDeliverable !== "—") return fromDeliverable;

  if (!options?.allowLineMasterFallback || !draft) return "—";
  if (draft.revenue <= 0) return "—";
  const afPct = draft.afPct > 0 ? draft.afPct : 0;
  const total = draft.revenue + (draft.revenue * afPct) / 100;
  return formatDeliverablePrice(total, currency);
}
