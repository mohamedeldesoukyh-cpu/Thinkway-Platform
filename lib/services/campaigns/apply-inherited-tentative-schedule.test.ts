import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyInheritedTentativeScheduleToLine } from "./apply-inherited-tentative-schedule";

test("inherited planning preserves actual dates, statuses and publication metadata", async () => {
  const writes: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const db = { from(table: string) {
    let patch: Record<string, unknown> | undefined;
    const query = {
      select() { return query; }, eq() { return query; }, order() { return query; }, is() { return query; },
      update(value: Record<string, unknown>) { patch = value; return query; },
      then(resolve: (value: unknown) => unknown) {
        if (patch) { writes.push({ table, patch }); return Promise.resolve(resolve({ error: null })); }
        const data = table === "assignment_deliverables"
          ? [{ id: "d1", platform: "instagram", deliverable_type: "IG Reel", quantity: 1, live_date: "2026-08-14", metadata: { went_live: true, workflow_status: "posted" } }]
          : [{ id: "p1", sequence_number: 1, metadata: { live_date_source: "publication", publication_id: "pub1" } }];
        return Promise.resolve(resolve({ data, error: null }));
      },
    };
    return query;
  } };
  const result = await applyInheritedTentativeScheduleToLine(db as unknown as SupabaseClient, {
    campaignLineId: "line1",
    scheduleHints: [{ platform: "instagram", deliverableType: "IG Reel", tentative_posting_date: "2026-08-01" }],
  });
  assert.equal(result.updatedDeliverables, 1);
  assert.equal(result.updatedPosts, 1);
  assert.equal(writes.length, 2);
  for (const { patch } of writes) {
    assert.equal("live_date" in patch, false);
    assert.equal("status" in patch, false);
    assert.equal((patch.metadata as Record<string, unknown>).planned_posting_date, "2026-08-01");
  }
  assert.equal((writes[0].patch.metadata as Record<string, unknown>).went_live, true);
  assert.equal((writes[1].patch.metadata as Record<string, unknown>).publication_id, "pub1");
});
