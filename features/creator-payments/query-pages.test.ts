import assert from "node:assert/strict";
import test from "node:test";
import { allPaymentRows, paymentRowsByIds } from "./query-pages";

test("payment entries are fully paginated, including exact page boundaries", async () => {
  const rows = Array.from({ length: 1000 }, (_, id) => id);
  const offsets: number[] = [];
  const result = await allPaymentRows({ range: async (start, end) => {
    offsets.push(start); return { data: rows.slice(start, end + 1), error: null };
  } });
  assert.deepEqual(result.data, rows);
  assert.deepEqual(offsets, [0, 500, 1000]);
});

test("ID chunks run concurrently with a limit of four, without duplicates or reordering", async () => {
  const ids = Array.from({ length: 650 }, (_, id) => String(id));
  let active = 0, peak = 0;
  const result = await paymentRowsByIds([...ids, ids[0]], chunk => ({ range: async () => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return { data: chunk, error: null };
  } }));
  assert.equal(peak, 4);
  assert.deepEqual(result.data, ids);
});

test("a failed page fails the load rather than returning incomplete balances", async () => {
  await assert.rejects(paymentRowsByIds(['one'], () => ({ range: async () => ({ data: null, error: { message: 'failed read' } }) })), /failed read/);
});
