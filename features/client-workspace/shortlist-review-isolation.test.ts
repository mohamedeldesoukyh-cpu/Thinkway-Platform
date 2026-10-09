import assert from "node:assert/strict";
import { test } from "node:test";
import { persistClientReview } from "./persist-client-review";

test("publishing a shortlist client link preserves internal creator statuses", async () => {
  const writes: string[] = [];
  const journey = { id: "journey", share_token: "existing-token", landing_review_id: "review", shortlist_id: "shortlist" };
  const supabase = {
    from(table: string) {
      let inserted: Record<string, unknown> | undefined;
      const q = {
        select() { return q; }, eq() { return q; }, in() { return q; }, neq() { return q; },
        order() { return q; }, limit() { return q; },
        insert(value: Record<string, unknown>) { writes.push(table); inserted = value; return q; },
        update() { writes.push(table); return q; },
        maybeSingle: async () => ({ data: table === "campaign_client_journeys" ? journey : null, error: null }),
        single: async () => ({ data: { ...inserted, id: "review" }, error: null }),
        then(resolve: (value: unknown) => unknown) { return Promise.resolve({ data: [], error: null }).then(resolve); },
      };
      return q;
    },
  };
  const result = await persistClientReview({
    supabase: supabase as never, userId: "user", origin: "https://example.test",
    source: "shortlist", scope: { source: "shortlist", shortlistId: "shortlist" },
    shortlistId: "shortlist", clientLabel: null, brandName: null, campaignName: null,
    fingerprint: {}, selection: {}, snapshot: {} as never, alreadyOpenMessage: "Already open",
  });
  assert.equal(result.ok, true);
  assert.ok(writes.includes("campaign_client_reviews"));
  assert.ok(writes.includes("campaign_client_review_events"));
  assert.equal(writes.includes("discovery_shortlist_items"), false, "Client sharing must not submit creators for internal review");
  assert.equal(writes.includes("discovery_shortlists"), false);
});
