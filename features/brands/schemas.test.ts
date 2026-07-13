import assert from "node:assert/strict";
import test from "node:test";

import { createBrandSchema } from "./schemas";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";

test("createBrandSchema accepts client_id and name without group_id", () => {
  const parsed = createBrandSchema.safeParse({
    client_id: CLIENT_ID,
    name: "Test Brand",
    currency_code: "USD",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.client_id, CLIENT_ID);
    assert.equal(parsed.data.name, "Test Brand");
    assert.equal("group_id" in parsed.data, false);
  }
});

test("createBrandSchema does not require category or subcategory", () => {
  const parsed = createBrandSchema.safeParse({
    client_id: CLIENT_ID,
    name: "Agency Brand",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.category_id, undefined);
    assert.equal(parsed.data.subcategory_id, undefined);
  }
});
