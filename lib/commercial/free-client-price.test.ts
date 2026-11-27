import test from "node:test";
import assert from "node:assert/strict";
import { readFreeClientPrice, toggleFreeClientPrice } from "./free-client-price";
test("free billing restores manual revenue and usage after save/reopen", () => {
  const free = toggleFreeClientPrice(readFreeClientPrice(null), 91000, 12500, true);
  assert.equal(free.revenue, 0); assert.equal(free.usage, 0);
  const restored = toggleFreeClientPrice(readFreeClientPrice(JSON.parse(JSON.stringify(free))), 0, 0, false);
  assert.equal(restored.revenue, 91000); assert.equal(restored.usage, 12500);
  assert.equal(restored.client_price_before_free, null);
});
test("repeated free selection does not replace the retained price with zero", () => {
  const free = toggleFreeClientPrice(readFreeClientPrice(null), 12500, 0, true);
  const again = toggleFreeClientPrice(free, 0, 0, true);
  assert.equal(toggleFreeClientPrice(again, 0, 0, false).revenue, 12500);
});
test("ordinary zero billing is not inferred as free and invalid backup is ignored", () => {
  assert.equal(readFreeClientPrice(null).free_for_client, false);
  assert.equal(readFreeClientPrice({free_for_client:true,client_price_before_free:{revenue:-1,usage:0}}).free_for_client,false);
  assert.equal(toggleFreeClientPrice(readFreeClientPrice(null), 7500, 0, false).revenue,7500);
});
