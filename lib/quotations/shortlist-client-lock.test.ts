import assert from "node:assert/strict";
import { test } from "node:test";
import { shortlistClientConflict } from "./shortlist-client-lock";

const source = { client_id: "source-client", brand_id: "source-brand" };
test("source identity can be restored without changing links", () => {
  assert.equal(shortlistClientConflict(source, { ...source }), null);
});
test("independent reassignment and clearing are rejected", () => {
  for (const patch of [{ client_id: "other" }, { client_id: null }, { brand_id: "other" }, { brand_id: null }, { is_temporary_client: true }, { is_temporary_brand: true }]) {
    assert.ok(shortlistClientConflict(source, patch));
  }
});
test("unrelated edits remain permitted", () => {
  assert.equal(shortlistClientConflict(source, { notes: "note" }), null);
});
test("unassigned shortlists allow identity setup", () => {
  assert.equal(shortlistClientConflict({ client_id: null, brand_id: null }, { client_id: "new" }), null);
});
