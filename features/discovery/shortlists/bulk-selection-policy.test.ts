import assert from "node:assert/strict";

import {
  countSelected,
  describeBulkOutcome,
  filterEligibleForMove,
  filterEligibleForRemove,
  filterEligibleForSubmit,
  filterSelectedItems,
  isAllVisibleSelected,
  isIndeterminateSelection,
  pruneSelection,
  resolveGroupCheckboxState,
  resolveBulkTargetIds,
  toggleGroupSelection,
  toggleItemSelection,
  toggleSelectAll,
} from "@/features/discovery/shortlists/bulk-selection-policy";
import {
  canBulkApproveItem,
  canMoveItemToCampaign,
  canRemoveItem,
  canSubmitItemForReview,
  canTransitionItem,
} from "@/features/discovery/shortlists/item-transitions";

const items = [
  { item_id: "a", item_status: "draft" as const },
  { item_id: "b", item_status: "under_review" as const },
  { item_id: "c", item_status: "approved" as const },
  { item_id: "d", item_status: "moved_to_campaign" as const },
];

// ---------------------------------------------------------------------------
// Selection toggles
// ---------------------------------------------------------------------------
{
  let selected = new Set<string>();
  selected = toggleItemSelection(selected, "a", true);
  assert.equal(selected.has("a"), true);
  selected = toggleItemSelection(selected, "a", false);
  assert.equal(selected.has("a"), false);
}

{
  const ids = ["a", "b", "c"];
  const all = toggleSelectAll(ids, new Set(), true);
  assert.equal(isAllVisibleSelected(ids, all), true);
  assert.equal(countSelected(all), 3);

  const cleared = toggleSelectAll(ids, all, false);
  assert.equal(countSelected(cleared), 0);
}

{
  const ids = ["a", "b"];
  const partial = new Set(["a"]);
  assert.equal(isIndeterminateSelection(ids, partial), true);
  assert.equal(isAllVisibleSelected(ids, partial), false);
}

{
  const group = ["a", "b"];
  const selected = toggleGroupSelection(group, new Set());
  assert.equal(isAllVisibleSelected(group, selected), true);

  const cleared = toggleGroupSelection(group, selected);
  assert.equal(countSelected(cleared), 0);

  const partial = new Set(["a"]);
  assert.equal(resolveGroupCheckboxState(group, partial), "indeterminate");
  assert.equal(resolveGroupCheckboxState(group, new Set(["a", "b"])), true);
}

// ---------------------------------------------------------------------------
// Persistence pruning (removed items drop out of selection)
// ---------------------------------------------------------------------------
{
  const pruned = pruneSelection(new Set(["a", "b", "gone"]), ["a", "b"]);
  assert.deepEqual([...pruned], ["a", "b"]);
}

// ---------------------------------------------------------------------------
// Bulk target resolution
// ---------------------------------------------------------------------------
{
  const { mode, ids } = resolveBulkTargetIds(["a", "b", "c"], new Set(["a", "c"]));
  assert.equal(mode, "selected");
  assert.deepEqual(ids, ["a", "c"]);
}

{
  const { mode } = resolveBulkTargetIds(["a"], new Set());
  assert.equal(mode, "none");
}

// ---------------------------------------------------------------------------
// Eligibility filters (mixed statuses)
// ---------------------------------------------------------------------------
assert.equal(filterEligibleForSubmit(items).length, 1);
assert.equal(filterEligibleForRemove(items).length, 2);
assert.equal(filterEligibleForMove(items).length, 1);
assert.equal(filterSelectedItems(items, new Set(["b", "d"])).map((i) => i.item_id).join(","), "b,d");

// ---------------------------------------------------------------------------
// Item transitions
// ---------------------------------------------------------------------------
assert.equal(canSubmitItemForReview("draft"), true);
assert.equal(canSubmitItemForReview("under_review"), false);
assert.equal(canBulkApproveItem("under_review"), true);
assert.equal(canMoveItemToCampaign("approved"), true);
assert.equal(canMoveItemToCampaign("draft"), false);
assert.equal(canRemoveItem("moved_to_campaign"), false);
assert.equal(canTransitionItem("draft", "under_review"), true);
assert.equal(canTransitionItem("draft", "approved"), false);

// ---------------------------------------------------------------------------
// Outcome messaging
// ---------------------------------------------------------------------------
assert.match(
  describeBulkOutcome({ action: "removed", requested: 3, updated: 2, skipped: 1 }),
  /2 creator\(s\) removed/
);

console.log("bulk-selection-policy.test.ts: all assertions passed");
