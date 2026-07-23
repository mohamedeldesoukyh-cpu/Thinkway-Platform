import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";
import { resolveCollapseContentLabel } from "@/lib/discovery/collapse-content";

export type ShortlistDisplayBlock =
  | {
      kind: "collapse";
      collapseGroupId: string;
      label: string;
      items: ShortlistCreatorItem[];
    }
  | {
      kind: "creator";
      items: [ShortlistCreatorItem];
    };

/** Preserve list order while grouping collapsed creators under one block. */
export function buildShortlistDisplayBlocks(
  items: ShortlistCreatorItem[]
): ShortlistDisplayBlock[] {
  const collapseMembers = new Map<string, ShortlistCreatorItem[]>();
  for (const item of items) {
    if (!item.collapse_group_id) continue;
    const bucket = collapseMembers.get(item.collapse_group_id) ?? [];
    bucket.push(item);
    collapseMembers.set(item.collapse_group_id, bucket);
  }

  const blocks: ShortlistDisplayBlock[] = [];
  const seenCollapse = new Set<string>();

  for (const item of items) {
    const collapseId = item.collapse_group_id;
    if (collapseId) {
      if (seenCollapse.has(collapseId)) continue;
      seenCollapse.add(collapseId);
      const members = collapseMembers.get(collapseId) ?? [item];
      blocks.push({
        kind: "collapse",
        collapseGroupId: collapseId,
        label: resolveCollapseContentLabel(members),
        items: members,
      });
      continue;
    }

    blocks.push({ kind: "creator", items: [item] });
  }

  return blocks;
}

function distinctCollapseGroupIds(items: ShortlistCreatorItem[]): string[] {
  return [
    ...new Set(
      items.map((item) => item.collapse_group_id).filter((id): id is string => Boolean(id))
    ),
  ];
}

/** Collapse when 2+ creators are selected and they are not already one complete bundle. */
export function selectedItemsCanCollapse(items: ShortlistCreatorItem[]): boolean {
  if (items.length < 2) return false;

  const groupIds = distinctCollapseGroupIds(items);
  if (groupIds.length > 1) return false;

  const ungroupedCount = items.filter((item) => !item.collapse_group_id).length;
  if (groupIds.length === 1 && ungroupedCount === 0) return false;

  return true;
}

/** Uncollapse when at least one selected creator belongs to a collapse bundle. */
export function selectedItemsCanUncollapse(items: ShortlistCreatorItem[]): boolean {
  return items.some((item) => item.collapse_group_id != null);
}
