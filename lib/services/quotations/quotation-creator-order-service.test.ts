import assert from "node:assert/strict";
import { test } from "node:test";
import { saveQuotationCreatorOrder } from "./quotation-creator-order-service";
function fixture(overrides: Record<string, unknown> = {}, updated: unknown = {id: "q1"}) {
  const quotation = { metadata: {hideCostAndFees: true, unrelated: {keep: 1}, creatorListOrder: ["a", "b"]}, status: "draft", is_archived: false, updated_at: "2026-10-15T00:00:00Z", ...overrides };
  const writes: {table: string; patch: Record<string, unknown>; filters: [string, unknown][]}[] = [];
  const queries: {table: string; filters: [string, unknown][]}[] = [];
  const client = {from(table: string) {
    const query = {table, filters: [] as [string, unknown][]}; queries.push(query);
    let mutation = false;
    const builder = {
      select: () => builder,
      eq: (key: string, value: unknown) => {query.filters.push([key, value]); return builder;},
      update: (patch: Record<string, unknown>) => { mutation = true; writes.push({...query, patch}); return builder; },
      maybeSingle: async () => ({ data: mutation ? updated : quotation, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({data: [{id: "a"}, {id: "b"}], error: null}).then(resolve),
    };
    return builder;
  }};
  return {client: client as never, quotation, writes, queries};
}
test("save changes only presentation metadata and uses quotation scope plus concurrency guards", async () => {
  const f = fixture(); const before = structuredClone(f.quotation);
  assert.equal((await saveQuotationCreatorOrder(f.client, "q1", ["b", "a"])).ok, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].table, "quotations");
  assert.deepEqual(Object.keys(f.writes[0].patch).sort(), ["metadata", "updated_at"]);
  assert.deepEqual(f.writes[0].patch.metadata, {...before.metadata, creatorListOrder: ["b", "a"]});
  assert.deepEqual(f.quotation, before);
  assert.deepEqual(f.writes[0].filters, [["id", "q1"], ["updated_at", before.updated_at], ["status", "draft"], ["is_archived", false]]);
  assert.deepEqual(f.queries.find(q => q.table === "quotation_items")?.filters, [["quotation_id", "q1"]]);
});
test("restore automatic only removes the custom order", async () => {
  const f = fixture(); assert.equal((await saveQuotationCreatorOrder(f.client, "q1", [])).ok, true);
  assert.deepEqual(f.writes[0].patch.metadata, {hideCostAndFees: true, unrelated: {keep: 1}});
});
test("invalid, duplicate, partial and other-quotation line IDs cannot be saved", async () => {
  for (const ids of [null, "a", ["a", "a"], ["a"], ["a", "outside"], ["a", 4], [" "]]) {
    const f = fixture(); assert.equal((await saveQuotationCreatorOrder(f.client, "q1", ids)).ok, false);
    assert.equal(f.writes.length, 0);
  }
});
test("approved and archived quotations retain existing protection", async () => {
  for (const override of [{status: "approved"}, {status: "archived"}, {is_archived: true}]) {
    const f = fixture(override); assert.equal((await saveQuotationCreatorOrder(f.client, "q1", ["b", "a"])).ok, false);
    assert.equal(f.writes.length, 0);
  }
});
test("concurrent quotation changes return an error instead of claiming a save", async () => {
  const f = fixture({}, null); const result = await saveQuotationCreatorOrder(f.client, "q1", ["b", "a"]);
  assert.equal(result.ok, false); assert.match(result.message ?? "", /changed while saving/);
});
