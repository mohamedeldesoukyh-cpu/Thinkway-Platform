import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { resolveCollapseContentLabel } from "@/lib/discovery/collapse-content";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";
import {
  buildCreatorGroupsFromSortedItems,
  type QuotationWorkspaceCreatorGroup,
} from "@/lib/quotations/quotation-workspace-sort";

export type QuotationCollapseDisplayGroup = {
  kind: "collapse";
  collapseGroupId: string;
  label: string;
  creatorGroups: QuotationWorkspaceCreatorGroup[];
};

export type QuotationCreatorDisplayGroup = {
  kind: "creator";
  creatorKey: string;
  items: QuotationItemRow[];
};

export type QuotationWorkspaceDisplayGroup =
  | QuotationCollapseDisplayGroup
  | QuotationCreatorDisplayGroup;

/** Group quotation lines — collapse bundles first, then per-creator groups. */
export function buildQuotationWorkspaceDisplayGroups(
  sortedItems: QuotationItemRow[]
): QuotationWorkspaceDisplayGroup[] {
  const collapseMembers = new Map<string, QuotationItemRow[]>();
  for (const item of sortedItems) {
    if (!item.collapse_group_id) continue;
    const bucket = collapseMembers.get(item.collapse_group_id) ?? [];
    bucket.push(item);
    collapseMembers.set(item.collapse_group_id, bucket);
  }

  const groups: QuotationWorkspaceDisplayGroup[] = [];
  const seenCollapse = new Set<string>();
  const seenCreator = new Set<string>();

  for (const item of sortedItems) {
    const collapseId = item.collapse_group_id;
    if (collapseId) {
      if (seenCollapse.has(collapseId)) continue;
      seenCollapse.add(collapseId);
      const members = collapseMembers.get(collapseId) ?? [item];
      groups.push({
        kind: "collapse",
        collapseGroupId: collapseId,
        label: resolveCollapseContentLabel(members),
        creatorGroups: buildCreatorGroupsFromSortedItems(members),
      });
      continue;
    }

    const key = quotationCreatorDuplicateKey(item);
    if (seenCreator.has(key)) continue;
    seenCreator.add(key);
    const creatorItems = sortedItems.filter(
      (row) => !row.collapse_group_id && quotationCreatorDuplicateKey(row) === key
    );
    groups.push({ kind: "creator", creatorKey: key, items: creatorItems });
  }

  return groups;
}
