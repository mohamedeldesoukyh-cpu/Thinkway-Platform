import assert from "node:assert/strict";

import type {
  CreatorMovementAction,
  ShortlistStatus,
} from "@/types/database";
import {
  assertTransition,
  canEditCreators,
  canMoveToCampaign,
  isMovementLocked,
} from "@/features/discovery/shortlists/transitions";
import {
  assertShortlistApprovedForMove,
  SHORTLIST_NOT_APPROVED_MESSAGE,
  validateMoveToCampaign,
  type MoveTarget,
} from "@/features/discovery/shortlists/move-policy";

/**
 * Pure in-memory simulation of the Discovery Shortlist V2 workflow. It exercises
 * the SAME guard functions the server actions use (transitions, move-policy,
 * approval assertion) and records an audit trail, so the 12 review scenarios are
 * covered without a live database. Integration against Supabase is noted in the
 * deliverable as requiring a live DB.
 */

type Movement = {
  action: CreatorMovementAction;
  creator: string;
  from: string;
  to: string;
};

type Assignment = {
  influencerId: string;
  campaignId: string;
  shortlistId: string;
  status: "suggested" | "removed";
};

class WorkflowEngine {
  status: ShortlistStatus = "draft";
  archived = false;
  creators = new Set<string>();
  assignments: Assignment[] = [];
  movements: Movement[] = [];
  serial: string;

  constructor(serial: string) {
    this.serial = serial;
  }

  private setStatus(to: ShortlistStatus) {
    assertTransition(this.status, to);
    this.status = to;
  }

  addCreator(id: string) {
    if (!canEditCreators(this.status)) {
      throw new Error("Creators can only be edited in Draft/Under Review.");
    }
    if (this.creators.has(id)) return; // idempotent
    this.creators.add(id);
    this.movements.push({
      action: "discovery_to_shortlist",
      creator: id,
      from: "discovery",
      to: this.serial,
    });
  }

  removeCreator(id: string) {
    if (!canEditCreators(this.status)) {
      throw new Error("Creators can only be edited in Draft/Under Review.");
    }
    this.creators.delete(id);
    this.movements.push({
      action: "creator_removed",
      creator: id,
      from: this.serial,
      to: "removed",
    });
  }

  submit() {
    if (isMovementLocked(this.status)) throw new Error("Cancelled list cannot submit.");
    if (this.creators.size === 0) throw new Error("Add a creator first.");
    this.setStatus("under_review");
    this.movements.push({ action: "shortlist_submitted", creator: "-", from: this.serial, to: this.serial });
  }

  approve() {
    this.setStatus("approved");
    this.movements.push({ action: "shortlist_approved", creator: "-", from: this.serial, to: this.serial });
  }

  reject() {
    this.setStatus("draft");
    this.movements.push({ action: "shortlist_rejected", creator: "-", from: this.serial, to: this.serial });
  }

  cancel() {
    this.setStatus("cancelled");
    this.movements.push({ action: "shortlist_cancelled", creator: "-", from: this.serial, to: this.serial });
  }

  reopen() {
    this.setStatus("draft");
    this.movements.push({ action: "shortlist_reopened", creator: "-", from: this.serial, to: this.serial });
  }

  softDelete() {
    this.setStatus("archived");
    this.archived = true;
    this.movements.push({ action: "shortlist_archived", creator: "-", from: this.serial, to: this.serial });
  }

  moveToCampaign(itemIds: string[], target: MoveTarget, campaignId: string) {
    // Shared approval gate (every entry point calls this).
    assertShortlistApprovedForMove(this.status);
    const validation = validateMoveToCampaign({
      status: this.status,
      selectedItemIds: itemIds,
      target,
    });
    if (!validation.ok) throw new Error(validation.message);

    for (const creator of itemIds) {
      // Duplicate protection: at most one shortlist assignment per (campaign, creator).
      const existing = this.assignments.find(
        (a) => a.campaignId === campaignId && a.influencerId === creator
      );
      if (existing) {
        existing.status = "suggested";
        continue;
      }
      this.assignments.push({
        influencerId: creator,
        campaignId,
        shortlistId: this.serial,
        status: "suggested",
      });
      this.movements.push({
        action: "shortlist_to_campaign",
        creator,
        from: this.serial,
        to: campaignId,
      });
    }
  }

  removeFromCampaign(creator: string, campaignId: string) {
    const a = this.assignments.find(
      (x) => x.campaignId === campaignId && x.influencerId === creator
    );
    if (!a) throw new Error("Assignment not found.");
    a.status = "removed";
    this.movements.push({
      action: "campaign_to_removed",
      creator,
      from: campaignId,
      to: "removed",
    });
  }

  returnToShortlist(creator: string, campaignId: string) {
    const a = this.assignments.find(
      (x) => x.campaignId === campaignId && x.influencerId === creator
    );
    if (!a) throw new Error("Assignment not found.");
    a.status = "removed";
    this.movements.push({
      action: "campaign_to_shortlist",
      creator,
      from: campaignId,
      to: this.serial,
    });
  }
}

// === Scenario 1: Create shortlist ===========================================
const sl = new WorkflowEngine("SL-2026-0001");
assert.equal(sl.status, "draft");
sl.addCreator("inf-1");
sl.addCreator("inf-2");
assert.equal(sl.creators.size, 2);

// === Scenario 2: Submit for review ==========================================
sl.submit();
assert.equal(sl.status, "under_review");

// === Scenario 3: Approve ====================================================
sl.approve();
assert.equal(sl.status, "approved");
assert.equal(canMoveToCampaign(sl.status), true);

// Approval gate before approval is rejected with the canonical message.
const draftEngine = new WorkflowEngine("SL-2026-0002");
draftEngine.addCreator("x");
assert.throws(
  () => draftEngine.moveToCampaign(["x"], { mode: "existing", campaignId: "c", campaignName: "C" }, "c"),
  (e: unknown) => e instanceof Error && e.message === SHORTLIST_NOT_APPROVED_MESSAGE
);

// === Scenario 4: Move to existing campaign ==================================
sl.moveToCampaign(
  ["inf-1"],
  { mode: "existing", campaignId: "TW-2026-0009", campaignName: "Existing" },
  "TW-2026-0009"
);
assert.equal(sl.assignments.length, 1);
assert.equal(sl.assignments[0].status, "suggested");

// === Scenario 5: Create new campaign from shortlist =========================
sl.moveToCampaign(
  ["inf-2"],
  { mode: "new", name: "Spring Launch", brandId: "brand-1" },
  "TW-2026-0010"
);
assert.equal(sl.assignments.length, 2);

// === Scenario 12: Duplicate prevention (moving same creator again) ==========
sl.moveToCampaign(
  ["inf-1"],
  { mode: "existing", campaignId: "TW-2026-0009", campaignName: "Existing" },
  "TW-2026-0009"
);
const inf1Assignments = sl.assignments.filter(
  (a) => a.influencerId === "inf-1" && a.campaignId === "TW-2026-0009"
);
assert.equal(inf1Assignments.length, 1, "no duplicate assignment row created");

// === Scenario 6: Remove creator from campaign ===============================
sl.removeFromCampaign("inf-2", "TW-2026-0010");
assert.equal(
  sl.assignments.find((a) => a.influencerId === "inf-2")?.status,
  "removed"
);

// === Scenario 7: Return creator to shortlist ================================
sl.returnToShortlist("inf-1", "TW-2026-0009");
assert.equal(
  sl.assignments.find((a) => a.influencerId === "inf-1")?.status,
  "removed"
);

// === Scenario 8: Cancel shortlist ===========================================
sl.cancel();
assert.equal(sl.status, "cancelled");
// Cancelled blocks add/remove/approve/move/submit; allows reopen.
assert.throws(() => sl.addCreator("inf-3"));
assert.throws(() => sl.removeCreator("inf-1"));
assert.throws(() => sl.submit());
assert.throws(() => sl.approve());
assert.throws(
  () => sl.moveToCampaign(["inf-1"], { mode: "existing", campaignId: "c", campaignName: "C" }, "c"),
  (e: unknown) => e instanceof Error && e.message === SHORTLIST_NOT_APPROVED_MESSAGE
);

// === Scenario 9: Reopen shortlist ===========================================
sl.reopen();
assert.equal(sl.status, "draft");
sl.addCreator("inf-3"); // editable again after reopen
assert.ok(sl.creators.has("inf-3"));

// === Scenario 10: Verify audit history ======================================
const actions = sl.movements.map((m) => m.action);
for (const required of [
  "discovery_to_shortlist",
  "shortlist_submitted",
  "shortlist_approved",
  "shortlist_to_campaign",
  "campaign_to_removed",
  "campaign_to_shortlist",
  "shortlist_cancelled",
  "shortlist_reopened",
] as CreatorMovementAction[]) {
  assert.ok(actions.includes(required), `audit missing ${required}`);
}
// No silent mutations: every business action recorded at least one movement.
assert.ok(sl.movements.length >= 10);

// === Scenario 11: Soft delete ===============================================
// Archive is reachable from draft and is terminal (no hard delete).
const archEngine = new WorkflowEngine("SL-2026-0003");
archEngine.softDelete();
assert.equal(archEngine.status, "archived");
assert.equal(archEngine.archived, true);
assert.throws(() => archEngine.reopen(), "archived is terminal — no hard delete/restore");

console.log("discovery shortlist workflow tests passed (12 scenarios)");
