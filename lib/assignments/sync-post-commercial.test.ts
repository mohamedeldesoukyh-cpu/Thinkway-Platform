import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { restampDeliverablePostCommercial } from "./sync-post-schedules";

test("editing deliverable totals preserves cents across three existing posts", async () => {
  const writes: Array<Record<string, number>> = [];
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: "a" }, { id: "b" }, { id: "c" }], error: null }) }) }),
      update: (value: Record<string, number>) => ({ eq: async () => { writes.push(value); return { error: null }; } }),
    }),
  } as unknown as SupabaseClient;
  await restampDeliverablePostCommercial(client, "deliverable", 100 / 3, 50 / 3,
    { revenue_vat_percent: 14, cost_vat_percent: 0, revenue_vat_exempt: false, cost_vat_exempt: true },
    { revenue: 100, cost: 50 });
  assert.equal(writes.length, 3);
  assert.equal(Math.round(writes.reduce((sum, row) => sum + row.revenue_before_vat, 0) * 100), 10000);
  assert.equal(Math.round(writes.reduce((sum, row) => sum + row.cost_before_vat, 0) * 100), 5000);
  assert.deepEqual(writes.map(row => row.revenue_before_vat), [33.33, 33.33, 33.34]);
});

test("post synchronization failure is reported instead of returning a successful save", async () => {
  const client = {
    from: () => ({ update: () => ({ eq: async () => ({ error: { message: "Post update failed" } }) }) }),
  } as unknown as SupabaseClient;
  await assert.rejects(restampDeliverablePostCommercial(client, "deliverable", 100, 50,
    { revenue_vat_percent: 0, cost_vat_percent: 0, revenue_vat_exempt: true, cost_vat_exempt: true }),
    /Post update failed/);
});
