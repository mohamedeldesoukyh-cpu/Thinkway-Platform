import assert from "node:assert/strict";
import test from "node:test";
import { syncShortlistAdditionsToQuotation } from "./engine";

test("bulk addition checks an unlinked shortlist once rather than once per creator", async () => {
  let reads = 0;
  const supabase = { from(table: string) {
    assert.equal(table, "discovery_shortlists");
    reads++;
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "list", quotation_id: null } }) }) }) };
  } };
  await syncShortlistAdditionsToQuotation(supabase as never, {
    shortlistId: "list", actorId: "actor", shortlistItemIds: Array.from({ length: 40 }, (_, i) => String(i)),
  });
  assert.equal(reads, 1);
});
