import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

import { getCreatorDeleteBlockers } from "./creator-delete-blockers";
import { deleteDiscoveryCreator } from "./delete-discovery-creator";

function fixture(archived: boolean[], otherTable?: string) {
  const deleted: string[] = [];
  const client = createClient("https://test.supabase.co", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const table = url.pathname.split("/").at(-1)!;
        if (init?.method === "DELETE") {
          deleted.push(table);
          return new Response(null, { status: 204 });
        }
        let rows: unknown[] = [];
        if (table === "discovery_shortlist_items") {
          assert.equal(url.searchParams.get("influencer_id"), "eq.creator-1");
          assert.match(url.searchParams.get("select")!, /shortlist:discovery_shortlists!inner\(/);
          assert.equal(url.searchParams.get("shortlist.is_archived"), "eq.false");
          // Simulate PostgREST filtering the parent before applying the row limit.
          rows = archived.flatMap((isArchived, index) => isArchived ? [] : [{
            id: `item-${index}`, shortlist_id: `shortlist-${index}`,
            shortlist: { id: `shortlist-${index}`, serial_number: `SL-${index}`, name: "Active list" },
          }]).slice(0, Number(url.searchParams.get("limit")));
        } else if (table === otherTable) {
          rows = [{ id: "protected-1", version_id: "version-1", creator_name: "Creator" }];
        }
        return Response.json(rows);
      },
    },
  });
  return { client, deleted };
}

test("archived-only shortlist links allow deletion and clean up creator entries", async () => {
  const { client, deleted } = fixture([true, true]);
  assert.equal((await getCreatorDeleteBlockers(client, "creator-1")).canDelete, true);
  assert.equal((await deleteDiscoveryCreator(client, "creator-1")).ok, true);
  assert.deepEqual(deleted, ["discovery_shortlist_items", "influencers"]);
});

test("an active shortlist after more than 50 archived links still blocks deletion", async () => {
  const { client, deleted } = fixture([...Array<boolean>(60).fill(true), false]);
  const result = await deleteDiscoveryCreator(client, "creator-1");
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.links?.[0]?.reference, "SL-60");
  assert.deepEqual(deleted, []);
});

for (const table of ["rate_card_lines", "quotation_items", "campaign_influencers", "deliverables", "vendor_ios", "campaign_publications"]) {
  test(`archived shortlist does not bypass ${table} protection`, async () => {
    const { client, deleted } = fixture([true], table);
    assert.equal((await deleteDiscoveryCreator(client, "creator-1")).ok, false);
    assert.deepEqual(deleted, []);
  });
}
