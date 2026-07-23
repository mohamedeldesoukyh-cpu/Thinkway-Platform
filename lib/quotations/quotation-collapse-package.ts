import type { QuotationLinePendingPayload } from "@/features/quotations/components/quotation-manual-save";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { quotationCreatorDuplicateKey } from "@/lib/quotations/quotation-creator-options";

/** Sorted collapse members — leader holds package pricing. */
export function collapsePackageGroupItems(
  items: QuotationItemRow[],
  collapseGroupId: string
): QuotationItemRow[] {
  return items
    .filter((item) => item.collapse_group_id === collapseGroupId)
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
}

export function collapsePackageLeaderItem(
  groupItems: readonly QuotationItemRow[]
): QuotationItemRow {
  return [...groupItems].sort(
    (a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id)
  )[0]!;
}

export function collapsePackageFollowerItems(
  groupItems: readonly QuotationItemRow[]
): QuotationItemRow[] {
  const leader = collapsePackageLeaderItem(groupItems);
  return groupItems.filter((item) => item.id !== leader.id);
}

/** Only the package leader contributes to live quotation totals. */
export function shouldIncludeItemInLiveTotals(
  item: QuotationItemRow,
  allItems: readonly QuotationItemRow[]
): boolean {
  if (!item.collapse_group_id) return true;
  const group = collapsePackageGroupItems([...allItems], item.collapse_group_id);
  return collapsePackageLeaderItem(group).id === item.id;
}

/** Union of linked platforms across all creators in a collapse package. */
export function unionCollapsePackagePlatforms(
  groupItems: readonly QuotationItemRow[]
): string[] {
  const found = new Set<string>();
  for (const item of groupItems) {
    if (item.platform?.trim()) {
      found.add(canonicalPlatformKey(item.platform));
    }
    for (const platform of item.creator_profile_source?.linkedPlatforms ?? []) {
      if (platform?.trim()) {
        found.add(canonicalPlatformKey(platform));
      }
    }
    for (const deliverable of item.deliverables ?? []) {
      const raw = deliverable.platform?.trim();
      if (!raw) continue;
      for (const platform of raw.split(",")) {
        const trimmed = platform.trim();
        if (trimmed) found.add(canonicalPlatformKey(trimmed));
      }
    }
  }
  return [...found];
}

/** Follower lines carry identity only — package price lives on the leader. */
export function collapsePackageFollowerPendingPayload(): QuotationLinePendingPayload {
  return {
    deliverables: [],
    service_description: null,
    revenue: 0,
    cost: 0,
    gp_pct: 0,
    gp_value: 0,
    mode: "cost_revenue",
  };
}

export function registerCollapsePackagePending(input: {
  leaderId: string;
  leaderPayload: QuotationLinePendingPayload;
  followerItems: readonly QuotationItemRow[];
  registerLinePending: (id: string, payload: QuotationLinePendingPayload) => void;
}): void {
  input.registerLinePending(input.leaderId, input.leaderPayload);
  const followerPayload = collapsePackageFollowerPendingPayload();
  for (const follower of input.followerItems) {
    input.registerLinePending(follower.id, followerPayload);
  }
}

/** Stable creator-set key — sibling Collap packages share the same signature. */
export function collapsePackageCreatorSignature(
  groupItems: readonly QuotationItemRow[]
): string {
  return [...groupItems]
    .map((item) => quotationCreatorDuplicateKey(item))
    .sort()
    .join("|");
}

function groupAllItemsByCollapseId(
  allItems: readonly QuotationItemRow[]
): Map<string, QuotationItemRow[]> {
  const byCollapseId = new Map<string, QuotationItemRow[]>();
  for (const item of allItems) {
    if (!item.collapse_group_id) continue;
    const bucket = byCollapseId.get(item.collapse_group_id) ?? [];
    bucket.push(item);
    byCollapseId.set(item.collapse_group_id, bucket);
  }
  return byCollapseId;
}

function sortCollapsePackageGroups(
  groups: readonly QuotationItemRow[][]
): QuotationItemRow[][] {
  return [...groups].sort((a, b) => {
    const leaderA = collapsePackageLeaderItem(a);
    const leaderB = collapsePackageLeaderItem(b);
    return (
      leaderA.sort_order - leaderB.sort_order || leaderA.id.localeCompare(leaderB.id)
    );
  });
}

function siblingCollapsePackageGroups(
  allItems: readonly QuotationItemRow[],
  groupItems: readonly QuotationItemRow[]
): QuotationItemRow[][] {
  const signature = collapsePackageCreatorSignature(groupItems);
  return sortCollapsePackageGroups(
    [...groupAllItemsByCollapseId(allItems).values()].filter(
      (members) => collapsePackageCreatorSignature(members) === signature
    )
  );
}

export function collapsePackageOptionNumber(
  allItems: readonly QuotationItemRow[],
  groupItems: readonly QuotationItemRow[]
): number {
  const collapseGroupId = groupItems[0]?.collapse_group_id;
  if (!collapseGroupId) return 1;

  const siblingGroups = siblingCollapsePackageGroups(allItems, groupItems);
  const index = siblingGroups.findIndex(
    (members) => members[0]?.collapse_group_id === collapseGroupId
  );
  return index >= 0 ? index + 1 : 1;
}

export function countCollapsePackageSiblings(
  allItems: readonly QuotationItemRow[],
  groupItems: readonly QuotationItemRow[]
): number {
  const signature = collapsePackageCreatorSignature(groupItems);
  let count = 0;
  for (const members of groupAllItemsByCollapseId(allItems).values()) {
    if (collapsePackageCreatorSignature(members) === signature) count++;
  }
  return count;
}

/** All quotation item ids across sibling Collap packages (same creator set). */
export function siblingCollapsePackageMemberIds(
  allItems: readonly QuotationItemRow[],
  groupItems: readonly QuotationItemRow[]
): string[] {
  return siblingCollapsePackageGroups(allItems, groupItems).flatMap((members) =>
    members.map((member) => member.id)
  );
}

export function nextCollapsePackageOptionNumber(
  allItems: readonly QuotationItemRow[],
  sourceGroupItems: readonly QuotationItemRow[]
): number {
  return countCollapsePackageSiblings(allItems, sourceGroupItems) + 1;
}

/** Assign package option 1, 2, 3… per Collap bundle (same creator set), not per creator line. */
export function buildCollapsePackageOptionRenumberPlan(
  items: readonly QuotationItemRow[]
): Array<{ id: string; option_number: number }> {
  const bySignature = new Map<string, QuotationItemRow[][]>();
  for (const members of groupAllItemsByCollapseId(items).values()) {
    const signature = collapsePackageCreatorSignature(members);
    const bucket = bySignature.get(signature) ?? [];
    bucket.push(members);
    bySignature.set(signature, bucket);
  }

  const updates: Array<{ id: string; option_number: number }> = [];
  for (const groups of bySignature.values()) {
    sortCollapsePackageGroups(groups).forEach((members, index) => {
      const optionNumber = index + 1;
      for (const member of members) {
        if (member.option_number !== optionNumber) {
          updates.push({ id: member.id, option_number: optionNumber });
        }
      }
    });
  }
  return updates;
}

/** True when selected ids cover every line in a single Collap group. */
export function isFullCollapsePackageSelection(
  allItems: readonly QuotationItemRow[],
  selectedIds: readonly string[]
): string | null {
  const selected = new Set(selectedIds);
  if (selected.size === 0) return null;

  const collapseIds = new Set<string>();
  for (const id of selected) {
    const item = allItems.find((row) => row.id === id);
    if (!item?.collapse_group_id) return null;
    collapseIds.add(item.collapse_group_id);
  }
  if (collapseIds.size !== 1) return null;

  const collapseGroupId = [...collapseIds][0]!;
  const members = collapsePackageGroupItems([...allItems], collapseGroupId);
  if (members.length !== selected.size) return null;
  if (!members.every((member) => selected.has(member.id))) return null;
  return collapseGroupId;
}
