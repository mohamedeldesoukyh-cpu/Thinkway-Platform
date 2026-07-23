import type { ShortlistItemStatus } from "@/types/database";

import {
  canBulkApproveItem,
  canBulkCancelItem,
  canBulkRejectItem,
  canMoveItemToCampaign,
  canRemoveItem,
  canSubmitItemForReview,
} from "./item-transitions";

export type SelectableItem = {
  item_id: string;
  item_status: ShortlistItemStatus;
};

export function toggleItemSelection(
  selected: ReadonlySet<string>,
  itemId: string,
  checked: boolean
): Set<string> {
  const next = new Set(selected);
  if (checked) next.add(itemId);
  else next.delete(itemId);
  return next;
}

export function toggleSelectAll(
  visibleItemIds: string[],
  selected: ReadonlySet<string>,
  checked: boolean
): Set<string> {
  const next = new Set(selected);
  for (const id of visibleItemIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

/** Toggle every member in a collapse bundle on/off (all-on if any member is off). */
export function toggleGroupSelection(
  memberIds: string[],
  selected: ReadonlySet<string>
): Set<string> {
  const allSelected =
    memberIds.length > 0 && memberIds.every((id) => selected.has(id));
  return toggleSelectAll(memberIds, selected, !allSelected);
}

export function resolveGroupCheckboxState(
  memberIds: string[],
  selected: ReadonlySet<string>
): boolean | "indeterminate" {
  if (memberIds.length === 0) return false;
  const selectedCount = memberIds.filter((id) => selected.has(id)).length;
  if (selectedCount === 0) return false;
  if (selectedCount === memberIds.length) return true;
  return "indeterminate";
}

export function isGroupPartiallyOrFullySelected(
  memberIds: string[],
  selected: ReadonlySet<string>
): boolean {
  return memberIds.some((id) => selected.has(id));
}

export function countSelected(selected: ReadonlySet<string>): number {
  return selected.size;
}

export function isAllVisibleSelected(
  visibleItemIds: string[],
  selected: ReadonlySet<string>
): boolean {
  if (visibleItemIds.length === 0) return false;
  return visibleItemIds.every((id) => selected.has(id));
}

export function isIndeterminateSelection(
  visibleItemIds: string[],
  selected: ReadonlySet<string>
): boolean {
  const count = visibleItemIds.filter((id) => selected.has(id)).length;
  return count > 0 && count < visibleItemIds.length;
}

export function filterSelectedItems<T extends { item_id: string }>(
  items: T[],
  selected: ReadonlySet<string>
): T[] {
  if (selected.size === 0) return [];
  return items.filter((item) => selected.has(item.item_id));
}

export function resolveBulkTargetIds(
  allItemIds: string[],
  selected: ReadonlySet<string>
): { mode: "selected" | "none"; ids: string[] } {
  if (selected.size === 0) return { mode: "none", ids: [] };
  const ids = allItemIds.filter((id) => selected.has(id));
  return { mode: "selected", ids };
}

export function filterEligibleForSubmit(items: SelectableItem[]): SelectableItem[] {
  return items.filter((item) => canSubmitItemForReview(item.item_status));
}

export function filterEligibleForRemove(items: SelectableItem[]): SelectableItem[] {
  return items.filter((item) => canRemoveItem(item.item_status));
}

export function filterEligibleForMove(items: SelectableItem[]): SelectableItem[] {
  return items.filter((item) => canMoveItemToCampaign(item.item_status));
}

export function filterEligibleForApprove(items: SelectableItem[]): SelectableItem[] {
  return items.filter((item) => canBulkApproveItem(item.item_status));
}

export function filterEligibleForReject(items: SelectableItem[]): SelectableItem[] {
  return items.filter((item) => canBulkRejectItem(item.item_status));
}

export function filterEligibleForCancel(items: SelectableItem[]): SelectableItem[] {
  return items.filter((item) => canBulkCancelItem(item.item_status));
}

export function pruneSelection(
  selected: ReadonlySet<string>,
  remainingItemIds: string[]
): Set<string> {
  const allowed = new Set(remainingItemIds);
  return new Set([...selected].filter((id) => allowed.has(id)));
}

export function describeBulkOutcome(input: {
  action: string;
  requested: number;
  updated: number;
  skipped: number;
}): string {
  if (input.updated === 0) {
    return `No creators were ${input.action}. ${input.skipped} skipped (wrong status).`;
  }
  if (input.skipped > 0) {
    return `${input.updated} creator(s) ${input.action}. ${input.skipped} skipped.`;
  }
  return `${input.updated} creator(s) ${input.action}.`;
}
