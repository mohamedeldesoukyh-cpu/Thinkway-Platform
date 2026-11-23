import assert from "node:assert/strict";
import { test } from "node:test";
import { mapBillingCampaigns } from "./map-billing-campaigns";

test("campaign loads overlap, remain bounded and retain financial row order", async () => {
  let active = 0;
  let peak = 0;
  const input = Array.from({ length: 11 }, (_, id) => ({ id, amount: id * 100 }));
  const output = await mapBillingCampaigns(input, async (row) => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, (4 - row.id % 4) * 3));
    active--;
    return row;
  });
  assert.equal(peak, 4);
  assert.deepEqual(output, input);
  assert.equal(active, 0);
});

test("empty queues make no requests; failures reach the dashboard fallback", async () => {
  assert.deepEqual(await mapBillingCampaigns([], async () => { throw new Error("unexpected"); }), []);
  await assert.rejects(mapBillingCampaigns([1], async () => { throw new Error("database unavailable"); }), /database unavailable/);
});
