import type { ShortlistCreatorItem } from "./types";
import { compareClientListCreators } from "@/lib/creators/client-list-order";
import { resolveCreatorTierFromUnified } from "@/lib/creators/creator-tier";
import { resolveSortFollowers } from "@/features/discovery/components/creator-search/creator-search-sort";
import { orderCreatorGroups } from "@/lib/quotations/quotation-creator-order";

export function orderShortlistCreators(items: ShortlistCreatorItem[], order: string[] = []) {
  return orderCreatorGroups(items, order, item => [item.item_id]);
}
export function tierOrderShortlistCreators(items: ShortlistCreatorItem[]) {
  return [...items].sort((a, b) => compareClientListCreators(
    { tier: a.creator ? resolveCreatorTierFromUnified(a.creator) : "Unknown", followers: a.creator ? resolveSortFollowers(a.creator) ?? 0 : 0 },
    { tier: b.creator ? resolveCreatorTierFromUnified(b.creator) : "Unknown", followers: b.creator ? resolveSortFollowers(b.creator) ?? 0 : 0 },
  ));
}
