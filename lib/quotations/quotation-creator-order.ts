import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { compareClientListCreators } from "@/lib/creators/client-list-order";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { hasUgcCategory } from "@/lib/creators/ugc-category";
import { quotationCreatorDuplicateKey } from "./quotation-creator-options";

/** Presentation only: saved quotation line IDs, grouped by creator. Never changes line values. */
export const CREATOR_LIST_ORDER_KEY = "creatorListOrder";
export function readCreatorListOrder(metadata: unknown): string[] {
  const value = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)[CREATOR_LIST_ORDER_KEY] : undefined;
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
}

/** Unknown/new creators follow the saved ones in the supplied default order. */
export function orderCreatorGroups<T>(groups: readonly T[], itemIds: readonly string[] | undefined, idsFor: (group: T) => readonly string[]): T[] {
  const positions = new Map((itemIds ?? []).map((id, index) => [id, index]));
  const rank = (group: T) => idsFor(group).reduce((best, id) => Math.min(best, positions.get(id) ?? Infinity), Infinity);
  return groups.map((group, index) => ({ group, index, rank: rank(group) }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank < b.rank ? -1 : 1))
    .map(({ group }) => group);
}

export type QuotationOrderCreator = { key: string; name: string; handle: string; items: QuotationItemRow[]; followers: number; tier: string };
export function quotationOrderCreators(items: QuotationItemRow[], order?: string[]): QuotationOrderCreator[] {
  const byCreator = new Map<string, QuotationOrderCreator>();
  for (const item of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const key = quotationCreatorDuplicateKey(item);
    const group = byCreator.get(key) ?? { key, name: item.creator_profile_source?.displayName || item.creator_name || item.handle || "Unnamed creator", handle: item.handle || "", items: [], followers: 0, tier: "Unknown" };
    group.items.push(item);
    const counts = (item.creator_profile_source?.platformAccounts ?? []).map(account => account.followers)
      .filter((count): count is number => count != null && Number.isFinite(count) && count > 0);
    group.followers = Math.max(group.followers, item.followers ?? 0, ...counts);
    byCreator.set(key, group);
  }
  for (const group of byCreator.values()) {
    const platforms = group.items.flatMap(item => item.creator_profile_source?.platformAccounts ?? [])
      .map(account => account.followers).filter((count): count is number => count != null && Number.isFinite(count) && count > 0);
    group.tier = resolveCreatorTierLabel({ followers: platforms.length ? Math.max(...platforms) : group.items[0].followers });
  }
  return orderCreatorGroups([...byCreator.values()].sort((a, b) =>
    Number(a.items.some(item => hasUgcCategory(item.creator_categories))) -
      Number(b.items.some(item => hasUgcCategory(item.creator_categories))) ||
    compareClientListCreators(a, b)
  ), order, group => group.items.map(item => item.id));
}

export function orderQuotationItems(items: QuotationItemRow[], order?: string[]): QuotationItemRow[] {
  if (!order?.length) return items;
  const groups = new Map<string, QuotationItemRow[]>();
  for (const item of items) {
    const key = quotationCreatorDuplicateKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return orderCreatorGroups([...groups.values()], order, group => group.map(item => item.id)).flat();
}

export function moveCreator<T>(creators: readonly T[], from: number, to: number): T[] {
  if (!Number.isInteger(from) || from < 0 || from >= creators.length || !Number.isInteger(to)) return [...creators];
  const next = [...creators];
  const [creator] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, creators.length - 1)), 0, creator);
  return next;
}
