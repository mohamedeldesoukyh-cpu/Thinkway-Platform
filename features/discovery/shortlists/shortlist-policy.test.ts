import assert from "node:assert/strict";

import {
  assertTransition,
  canEditCreators,
  canMoveToCampaign,
  canTransition,
  isMovementLocked,
  SHORTLIST_STATUS_TRANSITIONS,
} from "@/features/discovery/shortlists/transitions";
import {
  collidesWithCampaignSerial,
  isValidShortlistSerial,
  parseShortlistSerialYear,
  shortlistSerialPrefix,
} from "@/features/discovery/shortlists/serial";
import {
  buildNameMismatchWarning,
  shouldWarnNameMismatch,
  validateMoveToCampaign,
} from "@/features/discovery/shortlists/move-policy";
import {
  applyAddResult,
  describeAddOutcome,
  emptyOutcome,
  hasStandaloneShortlistCreator,
  isAddableCreator,
} from "@/features/discovery/shortlists/add-to-shortlist-policy";
import { existingKeysFromStandaloneShortlistItems } from "@/features/creators/picker/creator-selection-utils";

// ---------------------------------------------------------------------------
// Serial format (spec §1)
// ---------------------------------------------------------------------------
assert.equal(shortlistSerialPrefix(2026), "SL-2026");
assert.equal(isValidShortlistSerial("SL-2026-0001"), true);
assert.equal(isValidShortlistSerial("SL-2026-1234"), true);
assert.equal(isValidShortlistSerial("SL-2026-001"), false, "needs 4-digit pad");
assert.equal(isValidShortlistSerial("TW-2026-0001"), false, "campaign serial is not a shortlist serial");
assert.equal(isValidShortlistSerial(""), false);
assert.equal(isValidShortlistSerial(null), false);
assert.equal(parseShortlistSerialYear("SL-2026-0007"), 2026);
assert.equal(parseShortlistSerialYear("nope"), null);

// Must never collide with campaign serial space (distinct prefix)
assert.equal(collidesWithCampaignSerial("SL-2026-0001"), false);
assert.equal(collidesWithCampaignSerial("TW-2026-0001"), true);

// ---------------------------------------------------------------------------
// Status transitions (spec §3, §13)
// ---------------------------------------------------------------------------
assert.equal(canTransition("draft", "under_review"), true);
assert.equal(canTransition("under_review", "approved"), true);
assert.equal(canTransition("under_review", "draft"), true, "reject back to draft");
assert.equal(canTransition("approved", "cancelled"), true);
assert.equal(canTransition("approved", "archived"), true);
assert.equal(canTransition("cancelled", "draft"), true, "reopen");
assert.equal(canTransition("draft", "draft"), true, "same-status edit allowed");

// Illegal transitions
assert.equal(canTransition("draft", "approved"), false, "cannot skip review");
assert.equal(canTransition("approved", "draft"), false);
assert.equal(canTransition("cancelled", "approved"), false);
assert.equal(canTransition("archived", "draft"), false, "archived is terminal");
assert.deepEqual(SHORTLIST_STATUS_TRANSITIONS.archived, []);

assert.throws(() => assertTransition("draft", "approved"));
assert.doesNotThrow(() => assertTransition("draft", "under_review"));

// Editing / movement gates
assert.equal(canEditCreators("draft"), true);
assert.equal(canEditCreators("under_review"), true);
assert.equal(canEditCreators("approved"), false);
assert.equal(canEditCreators("cancelled"), false);
assert.equal(canMoveToCampaign("approved"), true);
assert.equal(canMoveToCampaign("draft"), false);
assert.equal(isMovementLocked("cancelled"), true);
assert.equal(isMovementLocked("archived"), true);
assert.equal(isMovementLocked("approved"), false);

// ---------------------------------------------------------------------------
// Move To Campaign validation (spec §5, §7, §8, §9)
// ---------------------------------------------------------------------------
// Only approved
assert.equal(
  validateMoveToCampaign({
    status: "draft",
    selectedItemIds: ["a"],
    target: { mode: "existing", campaignId: "c1", campaignName: "X" },
  }).ok,
  false
);

// Only selected creators move (none selected => error)
assert.equal(
  validateMoveToCampaign({
    status: "approved",
    selectedItemIds: [],
    target: { mode: "existing", campaignId: "c1", campaignName: "X" },
  }).ok,
  false
);

// Happy path existing
assert.equal(
  validateMoveToCampaign({
    status: "approved",
    selectedItemIds: ["a", "b"],
    target: { mode: "existing", campaignId: "c1", campaignName: "X" },
  }).ok,
  true
);

// New campaign requires name + brand
assert.equal(
  validateMoveToCampaign({
    status: "approved",
    selectedItemIds: ["a"],
    target: { mode: "new", name: "", brandId: "b1" },
  }).ok,
  false
);
assert.equal(
  validateMoveToCampaign({
    status: "approved",
    selectedItemIds: ["a"],
    target: { mode: "new", name: "Spring", brandId: "" },
  }).ok,
  false
);
assert.equal(
  validateMoveToCampaign({
    status: "approved",
    selectedItemIds: ["a"],
    target: { mode: "new", name: "Spring Launch", brandId: "b1" },
  }).ok,
  true
);

// Name mismatch warning (spec §8) — names never change automatically
assert.equal(shouldWarnNameMismatch("Beauty List", "TW-2026-0009 Beauty"), true);
assert.equal(shouldWarnNameMismatch("Beauty List", "beauty list"), false, "case/space-insensitive match");
assert.match(buildNameMismatchWarning("TW-2026-0009"), /TW-2026-0009/);
assert.match(
  buildNameMismatchWarning("TW-2026-0009"),
  /shortlist name will not replace the campaign name/
);

// ---------------------------------------------------------------------------
// Add-to-shortlist source-type handling (Part B — both source types addable)
// ---------------------------------------------------------------------------
// Imported / internal influencer (no discovered_profile_id) MUST be addable —
// this was the original bug.
assert.equal(
  isAddableCreator({ influencer_id: "inf-1", discovered_profile_id: null }),
  true,
  "imported influencer must be addable"
);
// Public discovery profile (no influencer_id) is addable.
assert.equal(
  isAddableCreator({ influencer_id: null, discovered_profile_id: "dis-1" }),
  true,
  "discovered profile must be addable"
);
// Promoted creator with both ids is addable.
assert.equal(
  isAddableCreator({ influencer_id: "inf-1", discovered_profile_id: "dis-1" }),
  true
);
// Neither reference => not addable.
assert.equal(
  isAddableCreator({ influencer_id: null, discovered_profile_id: null }),
  false
);

// Outcome folding from V2 action results.
let outcome = emptyOutcome();
outcome = applyAddResult(outcome, { ok: true, message: "Creator added to shortlist." });
outcome = applyAddResult(outcome, { ok: true, message: "Creator is already on this shortlist." });
outcome = applyAddResult(outcome, { ok: false, message: "Shortlist not found." });
assert.equal(outcome.added, 1);
assert.equal(outcome.alreadyOnList, 1);
assert.equal(outcome.failed, 1);
assert.equal(outcome.firstError, "Shortlist not found.");
assert.match(describeAddOutcome(outcome), /1 added/);
assert.match(describeAddOutcome(outcome), /already on list/);
assert.equal(describeAddOutcome(emptyOutcome()), "No creators added");

// Standalone duplicate policy: collapsed rows do not block re-add as individual.
assert.equal(
  hasStandaloneShortlistCreator(
    [
      {
        influencer_id: "inf-1",
        profile_id: null,
        unified_id: "u-1",
        collapse_group_id: "grp-1",
      },
    ],
    { influencerId: "inf-1" }
  ),
  false,
  "collapsed row should not block standalone add"
);
assert.equal(
  hasStandaloneShortlistCreator(
    [
      {
        influencer_id: "inf-1",
        profile_id: null,
        unified_id: "u-1",
        collapse_group_id: null,
      },
    ],
    { influencerId: "inf-1" }
  ),
  true,
  "standalone row blocks duplicate standalone add"
);

const collapsedOnlyKeys = existingKeysFromStandaloneShortlistItems([
  {
    unified_id: "u-1",
    profile_id: null,
    influencer_id: "inf-1",
    collapse_group_id: "grp-1",
  },
]);
assert.equal(collapsedOnlyKeys.has("inf:inf-1"), false);
assert.equal(
  existingKeysFromStandaloneShortlistItems([
    {
      unified_id: "u-1",
      profile_id: null,
      influencer_id: "inf-1",
      collapse_group_id: null,
    },
  ]).has("inf:inf-1"),
  true
);

console.log("discovery shortlist policy tests passed");
