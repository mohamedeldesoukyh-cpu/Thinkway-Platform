import assert from "node:assert/strict";

import {
  buildExistingCreatorKeys,
  creatorDedupKeys,
  deselectAllCreatorIds,
  deselectAllIds,
  filterSelectedCreators,
  isCreatorOnExistingList,
  resolveCreatorCheckboxState,
  selectAllCreatorIds,
  selectAllIds,
  toggleCreatorSelection,
  toggleIdSelection,
  toggleSelectAllVisible,
} from "./creator-selection-utils";

// toggleCreatorSelection
{
  const next = toggleCreatorSelection(new Set(["a"]), "b");
  assert.equal(next.size, 2);
  assert.ok(next.has("a"));
  assert.ok(next.has("b"));

  const off = toggleCreatorSelection(new Set(["a", "b"]), "a");
  assert.equal(off.size, 1);
  assert.ok(off.has("b"));

  const forced = toggleCreatorSelection(new Set(["a"]), "a", false);
  assert.equal(forced.size, 0);
}

// selectAll / deselectAll
{
  const all = selectAllCreatorIds(["x", "y"], new Set(["z"]));
  assert.equal(all.size, 3);

  const fewer = deselectAllCreatorIds(["x", "y"], all);
  assert.equal(fewer.size, 1);
  assert.ok(fewer.has("z"));
}

// toggleSelectAllVisible
{
  const selected = new Set(["a"]);
  const added = toggleSelectAllVisible(["a", "b", "c"], selected);
  assert.equal(added.size, 3);

  const removed = toggleSelectAllVisible(["a", "b", "c"], added);
  assert.equal(removed.size, 0);
}

// resolveCreatorCheckboxState
{
  assert.equal(resolveCreatorCheckboxState([], new Set()), false);
  assert.equal(resolveCreatorCheckboxState(["a", "b"], new Set(["a", "b"])), true);
  assert.equal(resolveCreatorCheckboxState(["a", "b"], new Set(["a"])), "indeterminate");
  assert.equal(resolveCreatorCheckboxState(["a", "b"], new Set()), false);
}

// filterSelectedCreators
{
  const creators = [
    { unified_id: "1", display_name: "One" },
    { unified_id: "2", display_name: "Two" },
  ];
  const filtered = filterSelectedCreators(creators, new Set(["2"]));
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.unified_id, "2");
}

// dedup keys
{
  const keys = buildExistingCreatorKeys([
    { unified_id: "u1", profile_id: "p1", influencer_id: "i1" },
  ]);
  assert.ok(keys.has("u1"));
  assert.ok(keys.has("dis:p1"));
  assert.ok(keys.has("inf:i1"));

  const creator = {
    unified_id: "u1",
    influencer_id: "i1",
    discovered_profile_id: "p1",
  } as Parameters<typeof creatorDedupKeys>[0];

  assert.deepEqual(creatorDedupKeys(creator), ["u1", "inf:i1", "dis:p1"]);
  assert.equal(isCreatorOnExistingList(creator, keys), true);
}

// generic id selection (quotation import)
{
  assert.deepEqual([...toggleIdSelection(new Set(["a"]), "b")], ["a", "b"]);
  assert.deepEqual([...selectAllIds(["a", "b"])], ["a", "b"]);
  assert.equal(deselectAllIds().size, 0);
}

console.log("creator-selection-hooks.test.ts: all assertions passed");
