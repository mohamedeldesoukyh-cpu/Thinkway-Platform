import assert from "node:assert/strict";
import { test } from "node:test";
import { persistClientReviewChange } from "./review-change-persistence";
import { reopenSelectionAllowed, selectionConfirmationFromSnapshots, withoutSelectionConfirmation } from "./reopen-selection";
import { selectionChangeAllowed, isSelectionConfirmed } from "./selection-flow";
import type { ClientReviewSourceSnapshot } from "./types";
import { retainCreatorBriefs } from "./snapshot-diff";

const snapshot = {
  creators: [{ creatorId: "creator", investmentAmount: 100 }],
  clientSelection: { confirmedAt: "2026-10-06", creatorIds: ["creator"] },
} as ClientReviewSourceSnapshot;
const review = { id: "review", updatedAt: "2026-10-29", clientLabel: "Client", sourceSnapshot: snapshot };

function database(fail = false) {
  const writes: Array<{ table: string; value: Record<string, unknown> }> = [];
  const filters: Array<[string, unknown]> = [];
  const client = { from(table: string) {
    const q = {
      update(value: Record<string, unknown>) { writes.push({ table, value }); return q; },
      eq(key: string, value: unknown) { filters.push([key, value]); return q; },
      select() { return q; },
      async single() { return { data: fail ? null : { id: review.id }, error: fail ? { message: "stale" } : null }; },
      async insert(value: Record<string, unknown>) { writes.push({ table, value }); return { error: null }; },
    };
    return q;
  } };
  return { client: client as never, writes, filters };
}

test("request changes saves feedback, clears selection confirmation, and records a client request", async () => {
  const db = database();
  const result = await persistClientReviewChange(db.client, review, { kind: "request", summary: "  Change the creator mix  ", areas: ["creator"] });
  assert.equal(result.ok, true);
  const patch = db.writes[0].value;
  assert.equal(patch.status, "changes_requested");
  assert.equal(patch.change_request_summary, "Change the creator mix");
  assert.deepEqual(patch.change_request_areas, ["creator"]);
  const next = patch.source_snapshot as ClientReviewSourceSnapshot;
  assert.equal(isSelectionConfirmed(next), false);
  assert.deepEqual(next.creators, snapshot.creators);
  assert.equal(selectionChangeAllowed({ selectionConfirmed: false, commerciallyApproved: false, current: "accepted", next: "in_review", priced: true }).ok, true);
  assert.equal(db.writes[1].table, "campaign_client_review_comments");
  assert.equal(db.writes[1].value.message, "Change the creator mix");
  assert.equal(db.writes[2].value.event_type, "changes_requested");
  assert.deepEqual(db.filters, [["id", review.id], ["updated_at", review.updatedAt]]);
  assert.ok(snapshot.clientSelection, "must not mutate the loaded snapshot");
  for (const field of ["approved_at", "approved_creator_ids", "selection_state"]) assert.equal(field in patch, false);
});

test("reopening keeps selections and review status but requires reconfirmation", async () => {
  const db = database();
  assert.equal((await persistClientReviewChange(db.client, review, { kind: "reopen" })).ok, true);
  assert.equal("status" in db.writes[0].value, false);
  assert.equal("selection_state" in db.writes[0].value, false);
  assert.equal(isSelectionConfirmed(db.writes[0].value.source_snapshot as ClientReviewSourceSnapshot), false);
  assert.equal(db.writes[1].value.event_type, "selection_reopened");
});

test("failed or stale writes do not report success or append a success event", async () => {
  for (const kind of ["reopen", "request"] as const) {
    const db = database(true);
    assert.equal((await persistClientReviewChange(db.client, review, { kind, summary: "Change", areas: [] })).ok, false);
    assert.equal(db.writes.length, 1);
  }
  const db = database();
  assert.equal((await persistClientReviewChange(db.client, review, { kind: "request", summary: "  ", areas: [] })).ok, false);
  assert.equal(db.writes.length, 0);
});

test("editing a confirmed selection never unlocks approved, historical or campaign quotations", () => {
  const open = { interactive: true, historical: false, commerciallyApproved: false, inCampaign: false };
  assert.equal(reopenSelectionAllowed(open), true);
  for (const blocked of [{ interactive: false }, { historical: true }, { commerciallyApproved: true }, { inCampaign: true }]) {
    assert.equal(reopenSelectionAllowed({ ...open, ...blocked }), false);
  }
});

test("reopening cannot resurrect a confirmation from an older shortlist", () => {
  const reopened = withoutSelectionConfirmation(snapshot);
  assert.equal(selectionConfirmationFromSnapshots(reopened, snapshot), undefined);
  assert.equal(selectionConfirmationFromSnapshots(snapshot, reopened), snapshot.clientSelection);
  const refreshed = retainCreatorBriefs(reopened, snapshot);
  assert.equal(refreshed.selectionReopenedAt, reopened.selectionReopenedAt);
  assert.equal(selectionConfirmationFromSnapshots(refreshed, snapshot), undefined);
});
