import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveShortlistClient } from "./resolve-shortlist-client";

test("recorded client is preserved without lookup", async () => {
  const row = { client_id: "client", brand_id: "brand" };
  assert.deepEqual(await resolveShortlistClient({} as never, row), { data: row, error: null });
});
test("brand-only shortlist inherits the brand client", async () => {
  const client = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { client_id: "source" }, error: null }) }) }) }) };
  const result = await resolveShortlistClient(client as never, { client_id: null, brand_id: "brand", id: "shortlist" });
  assert.deepEqual(result.data, { id: "shortlist", client_id: "source", brand_id: "brand" });
});
test("failed source lookup fails closed", async () => {
  const error = { message: "lookup failed" };
  const client = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error }) }) }) }) };
  assert.deepEqual(await resolveShortlistClient(client as never, { client_id: null, brand_id: "brand" }), { data: null, error });
});
