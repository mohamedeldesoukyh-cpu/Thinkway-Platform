import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordContentVersionDecisions } from "./content-decisions";

function fixture(overrides: { foreign?: boolean; unreleased?: boolean; stale?: boolean; fail?: boolean } = {}) {
  const writes: unknown[][] = [];
  const versions = ["one", "two"].map(id => ({ id, asset_id: id, metadata: overrides.unreleased ? {} : { released_to_client_at: "2026-09-22T00:00:00Z" }, storage_bucket: "assets", storage_path: id }));
  const assets = versions.map(v => ({ id: v.id, campaign_header_id: overrides.foreign ? "other" : "campaign", assignment_deliverable_id: v.id, assignment_post_schedule_id: null, medium: "file", archived_at: null, current_version_id: overrides.stale ? "newer" : v.id, asset_type: "video" }));
  const client = { from(table: string) { return {
    select() { return { in() { return Promise.resolve({ data: table === "deliverable_assets" ? assets : versions, error: null }); } }; },
    insert(rows: unknown[]) { writes.push(rows); return { select() { return Promise.resolve({ data: [{ decided_at: "2026-09-23T12:00:00Z" }], error: overrides.fail ? { message: "Save failed" } : null }); } }; },
  }; } } as unknown as SupabaseClient;
  return { client, writes };
}
const input = { versionIds: ["one", "two"], campaignHeaderId: "campaign", decision: "approved" as const, actorKind: "internal" as const, actorUserId: "team-user" };

test("bulk content approval writes once and returns the database approval date", async () => {
  const f = fixture();
  const result = await recordContentVersionDecisions(input, f.client);
  assert.equal(result.ok, true);
  assert.equal(result.decidedAt, "2026-09-23T12:00:00Z");
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].length, 2);
  assert.equal((f.writes[0][0] as { actor_kind: string }).actor_kind, "internal");
});
for (const flag of ["foreign", "unreleased", "stale"] as const) {
  test(`rejects ${flag} content before writing any approval`, async () => {
    const f = fixture({ [flag]: true });
    assert.equal((await recordContentVersionDecisions(input, f.client)).ok, false);
    assert.equal(f.writes.length, 0);
  });
}
test("database failures are not reported as approved", async () => {
  const f = fixture({ fail: true });
  const result = await recordContentVersionDecisions(input, f.client);
  assert.equal(result.ok, false);
  assert.equal(result.decidedAt, undefined);
});
