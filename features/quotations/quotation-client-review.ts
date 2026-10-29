import { chosenQuotationItemIds } from "@/features/client-workspace/quotation-options";
import type { ClientCreatorSelectionState, ClientReviewStatus } from "@/features/client-workspace/constants";
import { quotationItemClientCreatorId } from "@/features/client-workspace/quotation-item-creator-id";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { shouldIncludeItemInLiveTotals } from "@/lib/quotations/quotation-collapse-package";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";

export const QUOTATION_CLIENT_SELECTION_FILTERS = ["all", "accepted", "in_review", "rejected"] as const;
export type QuotationClientSelectionFilter = (typeof QUOTATION_CLIENT_SELECTION_FILTERS)[number];

export const QUOTATION_CLIENT_SELECTION_LABEL: Record<ClientCreatorSelectionState, string> = {
  accepted: "Selected",
  in_review: "Under review",
  rejected: "Rejected",
};

export type QuotationClientReviewView = {
  id: string;
  reviewNumber: number;
  status: ClientReviewStatus;
  selectionState: Record<string, ClientCreatorSelectionState>;
  approvedCreatorIds: string[] | null;
  changeRequestSummary: string | null;
  updatedAt: string;
  approvedAt: string | null;
};

export function clientSelectionForItem(
  item: Pick<QuotationItemRow, "id" | "unified_id" | "influencer_id" | "profile_id">,
  selection: Record<string, ClientCreatorSelectionState> | undefined
): ClientCreatorSelectionState {
  if (!selection) return "in_review";
  return selection[`quotation-item:${item.id}`] ?? selection[quotationItemClientCreatorId(item)] ?? "in_review";
}

export function clientSelectionForItems(
  items: Array<Pick<QuotationItemRow, "id" | "unified_id" | "influencer_id" | "profile_id">>,
  selection: Record<string, ClientCreatorSelectionState> | undefined
): ClientCreatorSelectionState {
  const states = new Set(items.map((item) => clientSelectionForItem(item, selection)));
  if (states.size === 1) return [...states][0]!;
  if (states.has("rejected") && states.has("accepted")) return "in_review";
  if (states.has("rejected")) return "rejected";
  if (states.has("accepted")) return "accepted";
  return "in_review";
}

export function filterItemsByClientSelection(
  items: QuotationItemRow[],
  selection: Record<string, ClientCreatorSelectionState> | undefined,
  filter: QuotationClientSelectionFilter
): QuotationItemRow[] {
  if (!selection || filter === "all") return items;
  return items.filter((item) => clientSelectionForItem(item, selection) === filter);
}

export function uniqueCreatorIdsForSelection(
  items: QuotationItemRow[],
  selection: Record<string, ClientCreatorSelectionState> | undefined,
  state: ClientCreatorSelectionState
): string[] {
  const ids = new Set<string>();
  for (const item of items) {
    if (clientSelectionForItem(item, selection) !== state) continue;
    ids.add(quotationCreatorDuplicateKey(item));
  }
  return [...ids];
}

export function countQuotationClientSelections(
  items: QuotationItemRow[],
  selection: Record<string, ClientCreatorSelectionState> | undefined
): { accepted: number; inReview: number; rejected: number; total: number } {
  const groups = new Map<string, QuotationItemRow[]>();
  for (const item of items) {
    const key = quotationCreatorDuplicateKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const states = [...groups.values()].map(group => clientSelectionForItems(group, selection));
  return {
    accepted: states.filter(state => state === "accepted").length,
    inReview: states.filter(state => state === "in_review").length,
    rejected: states.filter(state => state === "rejected").length,
    total: groups.size,
  };
}

export function itemIdsForClientSelection(
  items: QuotationItemRow[],
  selection: Record<string, ClientCreatorSelectionState> | undefined,
  state: ClientCreatorSelectionState
): string[] {
  return items
    .filter((item) => clientSelectionForItem(item, selection) === state)
    .map((item) => item.id);
}

export function totalsForClientSelection(
  items: QuotationItemRow[],
  selection: Record<string, ClientCreatorSelectionState> | undefined,
  state: ClientCreatorSelectionState
): { costEgp: number; revenueEgp: number; gpValueEgp: number; gpPct: number; creatorCount: number } {
  const scoped = items.filter((item) => clientSelectionForItem(item, selection) === state);
  const forTotals = scoped.filter((item) => shouldIncludeItemInLiveTotals(item, items));
  const costEgp = forTotals.reduce((sum, item) => sum + (item.cost_egp || 0), 0);
  const revenueEgp = forTotals.reduce((sum, item) => sum + (item.revenue_egp || 0), 0);
  const gpValueEgp = forTotals.reduce((sum, item) => sum + (item.gp_value_egp || 0), 0);
  const gpPct = revenueEgp > 0 ? (gpValueEgp / revenueEgp) * 100 : 0;
  return {
    costEgp,
    revenueEgp,
    gpValueEgp,
    gpPct,
    creatorCount: uniqueCreatorIdsForSelection(items, selection, state).length,
  };
}

/** Internal row actions must use exact chosen lines, rather than every option for an accepted creator. */
export function quotationOptionSelectionState(review: import('../client-workspace/types').ClientReviewRecord): Record<string, ClientCreatorSelectionState> {
  const selection = { ...review.selectionState };
  for (const creator of review.sourceSnapshot?.creators ?? []) {
    if (!creator.quotationOptions?.length) continue;
    const selectedIds = chosenQuotationItemIds(creator);
    for (const option of creator.quotationOptions ?? []) {
      for (const itemId of option.memberItemIds ?? [option.itemId]) {
      selection['quotation-item:' + itemId] = selection[creator.creatorId] === 'accepted'
        ? selectedIds.includes(option.itemId) ? 'accepted' : 'in_review'
        : selection[creator.creatorId] ?? 'in_review';
      }
    }
  }
  return selection;
}
