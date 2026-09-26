import assert from "node:assert/strict";
import { test } from "node:test";
import { persistContentReviewDates, readScheduleUnit } from "./content-review-schedule-service";

const input = { campaignHeaderId: "campaign", assignmentDeliverableId: "deliverable", assignmentPostScheduleId: "post-2", sequenceNumber: 2, dates: { script: "2026-09-27", draft: "2026-09-29" }, previous: { script: null, draft: null } };
function database(options: { conflict?: boolean; oldDates?: boolean; wrongSlot?: boolean; missing?: boolean; error?: boolean } = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const metadata = { other_data: "preserved", ...(options.oldDates ? { content_review_schedule: { "seq:2": { script: "2026-09-25", draft: null } } } : {}) };
  const db = { from(table: string) {
    let mutation = false;
    const q = {
      select(value: string) { calls.push([table, "select", value]); return q; },
      eq(key: string, value: unknown) { calls.push([table, "eq", key, value]); return q; },
      is(key: string, value: unknown) { calls.push([table, "is", key, value]); return q; },
      filter(key: string, op: string, value: unknown) { calls.push([table, "filter", key, op, value]); return q; },
      update(value: unknown) { mutation = true; calls.push([table, "update", value]); return q; },
      async maybeSingle() {
        return mutation ? { data: options.conflict ? null : { id: "deliverable" }, error: options.error ? { message: "error" } : null } :
          { data: options.missing ? null : table === "assignment_deliverables" ? { id: "deliverable", metadata, quantity: 2 } : { id: "post-2", sequence_number: options.wrongSlot ? 1 : 2 }, error: null };
      },
    }; return q;
  } } as unknown as Parameters<typeof persistContentReviewDates>[0];
  return { db, calls, metadata };
}
test("save scopes the unit to its campaign and writes only metadata with a compare-and-swap guard", async () => {
  const { db, calls, metadata } = database();
  const result = await persistContentReviewDates(db, "user", input);
  assert.equal(result.ok, true);
  assert.ok(calls.some(call => call[1] === "eq" && call[2] === "campaign_header_id" && call[3] === "campaign"));
  assert.ok(calls.some(call => call[0] === "assignment_post_schedule" && call[2] === "assignment_deliverable_id" && call[3] === "deliverable"));
  const update = calls.find(call => call[1] === "update")![2] as Record<string, unknown>;
  assert.deepEqual(Object.keys(update), ["metadata"]);
  assert.equal((update.metadata as Record<string, unknown>).other_data, "preserved");
  assert.ok(calls.some(call => call[1] === "filter" && call[2] === "metadata" && call[4] === JSON.stringify(metadata)));
});
test("stale editor values cannot overwrite newer review dates", async () => {
  const { db, calls } = database({ oldDates: true });
  const result = await persistContentReviewDates(db, "user", input);
  assert.equal(result.ok, false);
  assert.equal(calls.some(call => call[1] === "update"), false);
});
test("concurrent metadata edits and failed saves are reported, never treated as success", async () => {
  for (const option of [{ conflict: true }, { error: true }]) {
    const { db } = database(option);
    assert.equal((await persistContentReviewDates(db, "user", input)).ok, false);
  }
});
test("missing, mismatched and unmaterialized child slots cannot receive dates", async () => {
  await assert.rejects(readScheduleUnit(database({ missing: true }).db, input), /unavailable/);
  await assert.rejects(readScheduleUnit(database({ wrongSlot: true }).db, input), /changed/);
  await assert.rejects(readScheduleUnit(database().db, { ...input, sequenceNumber: 3 }), /individual content slot/);
  await assert.rejects(readScheduleUnit(database().db, { ...input, assignmentPostScheduleId: null }), /Create individual post slots/);
});
