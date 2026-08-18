import type { ClientCreatorSelectionState, ClientReviewStatus } from "@/features/client-workspace/constants";
import { quotationItemClientCreatorId } from "@/features/client-workspace/quotation-item-creator-id";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { shouldIncludeItemInLiveTotals } from "@/lib/quotations/quotation-collapse-package";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";

export const QUOTATION_CLIENT_SELECTION_FILTERS = ["all", "accepted", "in_review", "rejected"] as const;
export type QuotationClientSelectionFilter = (typeof QUOTATION_CLIENT_SELECTION_FILTERS)[number];

export const QUOTATION_CLIENT_SELECTION_LABEL: Record<ClientCreatorSelectionState, string> = {
  accepted: "Approved",
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
  return selection[quotationItemClientCreatorId(item)] ?? "in_review";
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
  const accepted = uniqueCreatorIdsForSelection(items, selection, "accepted").length;
  const inReview = uniqueCreatorIdsForSelection(items, selection, "in_review").length;
  const rejected = uniqueCreatorIdsForSelection(items, selection, "rejected").length;
  return { accepted, inReview, rejected, total: accepted + inReview + rejected };
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
