import { test } from "node:test";
import assert from "node:assert/strict";
import { moveQuotationService } from "./quotation-service-order";
test("service moves preserve occupied slots and unrelated creator positions", () => {
  const lines = [{ id: "a", sort_order: 2 }, { id: "b", sort_order: 5 }, { id: "c", sort_order: 9 }];
  assert.deepEqual(moveQuotationService(lines, "a", "c"), [{ id: "b", sort_order: 2 }, { id: "c", sort_order: 5 }, { id: "a", sort_order: 9 }]);
  assert.deepEqual(moveQuotationService(lines, "other-creator", "a"), []);
  assert.deepEqual(moveQuotationService(lines, "a", "a"), []);
  assert.equal(lines[0].id, "a");
});
