import type { UnifiedCreatorResult } from "@/lib/creators/types";

import type { CreatorCheckboxState, ExistingCreatorKey } from "./creator-selection-types";

export function toggleCreatorSelection(
  selected: ReadonlySet<string>,
  id: string,
  checked?: boolean
): Set<string> {
  const next = new Set(selected);
  const shouldSelect = checked ?? !next.has(id);
  if (shouldSelect) next.add(id);
  else next.delete(id);
  return next;
}

export function selectAllCreatorIds(
  ids: readonly string[],
  selected: ReadonlySet<string> = new Set()
): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.add(id);
  return next;
}

export function deselectAllCreatorIds(
  ids: readonly string[],
  selected: ReadonlySet<string>
): Set<string> {
  const next = new Set(selected);
  for (const id of ids) next.delete(id);
  return next;
}

export function toggleSelectAllVisible(
  visibleIds: readonly string[],
  selected: ReadonlySet<string>
): Set<string> {
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return allSelected
    ? deselectAllCreatorIds(visibleIds, selected)
    : selectAllCreatorIds(visibleIds, selected);
}

export function resolveCreatorCheckboxState(
  visibleIds: readonly string[],
  selected: ReadonlySet<string>
): CreatorCheckboxState {
  if (visibleIds.length === 0) return false;
  const selectedCount = visibleIds.filter((id) => selected.has(id)).length;
  if (selectedCount === 0) return false;
  if (selectedCount === visibleIds.length) return true;
  return "indeterminate";
}

export function filterSelectedCreators<T extends { unified_id: string }>(
  creators: T[],
  selected: ReadonlySet<string>
): T[] {
  if (selected.size === 0) return [];
  return creators.filter((c) => selected.has(c.unified_id));
}

export function countCreatorSelection(selected: ReadonlySet<string>): number {
  return selected.size;
}

export function buildExistingCreatorKeys(items: ExistingCreatorKey[]): Set<string> {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.unified_id) keys.add(item.unified_id);
    if (item.influencer_id) keys.add(`inf:${item.influencer_id}`);
    if (item.profile_id) keys.add(`dis:${item.profile_id}`);
  }
  return keys;
}

export type ShortlistExistingItemKey = ExistingCreatorKey & {
  collapse_group_id?: string | null;
};

/** Dedup keys for standalone shortlist rows only (collapsed rows can be re-added individually). */
export function existingKeysFromStandaloneShortlistItems(
  items: ShortlistExistingItemKey[]
): Set<string> {
  return buildExistingCreatorKeys(items.filter((item) => !item.collapse_group_id));
}

export function creatorDedupKeys(creator: UnifiedCreatorResult): string[] {
  const keys = [creator.unified_id];
  if (creator.influencer_id) keys.push(`inf:${creator.influencer_id}`);
  if (creator.discovered_profile_id) keys.push(`dis:${creator.discovered_profile_id}`);
  return keys;
}

export function isCreatorOnExistingList(
  creator: UnifiedCreatorResult,
  existingKeys: ReadonlySet<string>
): boolean {
  return creatorDedupKeys(creator).some((key) => existingKeys.has(key));
}

export function toggleIdSelection(selected: ReadonlySet<string>, id: string): Set<string> {
  return toggleCreatorSelection(selected, id);
}

export function selectAllIds(ids: readonly string[]): Set<string> {
  return new Set(ids);
}

export function deselectAllIds(): Set<string> {
  return new Set();
}
