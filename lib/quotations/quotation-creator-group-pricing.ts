import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";
import type { QuotationDeliverable, QuotationItemRow } from "@/features/quotations/types";
import type { QuotationWorkspaceDisplayGroup } from "@/lib/quotations/quotation-collapse-groups";
import { collapsePackageLeaderItem } from "@/lib/quotations/quotation-collapse-package";
import {
  computeDeliverableClientPrice,
  isDeliverableFreeForClient,
} from "@/lib/quotations/quotation-deliverable-commercial";

export type QuotationPricingCompleteness = "none" | "partial" | "complete";

const COMPLETENESS_RANK: Record<QuotationPricingCompleteness, number> = {
  none: 0,
  partial: 1,
  complete: 2,
};

export function deliverableHasUnitCost(deliverable: QuotationDeliverable): boolean {
  return (deliverable.cost ?? 0) > 0;
}

export function deliverableHasClientCost(
  deliverable: QuotationDeliverable,
  fxRateToEgp = 1
): boolean {
  if (isDeliverableFreeForClient(deliverable)) return true;
  return computeDeliverableClientPrice(deliverable, fxRateToEgp) > 0;
}

export function deliverablePricingCompleteness(
  deliverable: QuotationDeliverable,
  fxRateToEgp = 1
): QuotationPricingCompleteness {
  const hasUnit = deliverableHasUnitCost(deliverable);
  const hasClient = deliverableHasClientCost(deliverable, fxRateToEgp);
  if (!hasUnit && !hasClient) return "none";
  if (hasUnit && hasClient) return "complete";
  return "partial";
}

export function rowDraftPricingCompleteness(
  item: QuotationItemRow,
  rowDraft?: QuotationRowDraft
): QuotationPricingCompleteness {
  const hasUnit = (rowDraft?.cost ?? item.cost ?? 0) > 0;
  const hasClient = (rowDraft?.revenue ?? item.revenue ?? 0) > 0;
  if (!hasUnit && !hasClient) return "none";
  if (hasUnit && hasClient) return "complete";
  return "partial";
}

export function maxPricingCompleteness(
  ...states: readonly QuotationPricingCompleteness[]
): QuotationPricingCompleteness {
  return states.reduce<QuotationPricingCompleteness>(
    (best, next) => (COMPLETENESS_RANK[next] > COMPLETENESS_RANK[best] ? next : best),
    "none"
  );
}

export function mergePricingCompleteness(
  states: readonly QuotationPricingCompleteness[]
): QuotationPricingCompleteness {
  if (states.length === 0) return "none";
  if (states.some((state) => state === "none")) return "none";
  if (states.some((state) => state === "partial")) return "partial";
  return "complete";
}

export function quotationItemPricingCompleteness(
  item: QuotationItemRow,
  pending?: QuotationLinePendingPayload,
  rowDraft?: QuotationRowDraft
): QuotationPricingCompleteness {
  const deliverables = pending?.deliverables ?? item.deliverables ?? [];
  const fxRateToEgp = item.fx_rate_to_egp ?? 1;

  const fromDeliverables =
    deliverables.length > 0
      ? mergePricingCompleteness(
          deliverables.map((deliverable) =>
            deliverablePricingCompleteness(deliverable, fxRateToEgp)
          )
        )
      : "none";

  return maxPricingCompleteness(fromDeliverables, rowDraftPricingCompleteness(item, rowDraft));
}

export function quotationCreatorGroupPricingCompleteness(
  items: readonly QuotationItemRow[],
  getLinePending?: (itemId: string) => QuotationLinePendingPayload | undefined,
  drafts?: Record<string, QuotationRowDraft | undefined>
): QuotationPricingCompleteness {
  return mergePricingCompleteness(
    items.map((item) =>
      quotationItemPricingCompleteness(item, getLinePending?.(item.id), drafts?.[item.id])
    )
  );
}

export function quotationDisplayGroupPricingCompleteness(
  group: QuotationWorkspaceDisplayGroup,
  getLinePending?: (itemId: string) => QuotationLinePendingPayload | undefined,
  drafts?: Record<string, QuotationRowDraft | undefined>
): QuotationPricingCompleteness {
  if (group.kind === "collapse") {
    const packageItems = group.creatorGroups.flatMap((creatorGroup) => creatorGroup.items);
    const leader = collapsePackageLeaderItem(packageItems);
    return quotationItemPricingCompleteness(
      leader,
      getLinePending?.(leader.id),
      drafts?.[leader.id]
    );
  }

  return quotationCreatorGroupPricingCompleteness(group.items, getLinePending, drafts);
}

export function quotationCreatorCardPricingClass(
  completeness: QuotationPricingCompleteness
): string {
  switch (completeness) {
    case "complete":
      return "quotation-creator-card--green";
    case "partial":
      return "quotation-creator-card--orange";
    default:
      return "quotation-creator-card--missing-cost";
  }
}
