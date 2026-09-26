import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientReviewRecord } from "./types";
import { hydrateReviewCampaigns } from "./resolve-review-campaign";

const review = { id: "review", journeyId: "journey", quotationId: "quote", campaignHeaderId: null } as ClientReviewRecord;
function fixture(tables: Record<string, Record<string, string | null>[]>) {
  return { from(table: string) {
    return { select() { return { in(key: string, values: string[]) {
      return Promise.resolve({ data: (tables[table] ?? []).filter(row => values.includes(row[key] ?? "")) });
    } }; } };
  } } as unknown as SupabaseClient;
}

test("a quotation shared before campaign creation resolves its existing campaign", async () => {
  const db = fixture({ campaign_headers: [{ id: "campaign", quotation_id: "quote" }, { id: "foreign", quotation_id: "other" }] });
  const [result] = await hydrateReviewCampaigns(db, [review]);
  assert.equal(result.campaignHeaderId, "campaign");
  assert.equal(review.campaignHeaderId, null);
});

test("journey campaign resolves for a review with no quotation", async () => {
  const db = fixture({ campaign_client_journeys: [{ id: "journey", campaign_header_id: "campaign" }] });
  assert.equal((await hydrateReviewCampaigns(db, [{ ...review, quotationId: null }]))[0].campaignHeaderId, "campaign");
});

test("a campaign backlink on the quotation resolves without a header backlink", async () => {
  const db = fixture({ quotations: [{ id: "quote", campaign_header_id: "campaign" }] });
  assert.equal((await hydrateReviewCampaigns(db, [review]))[0].campaignHeaderId, "campaign");
});

test("missing and conflicting relationships do not expose another campaign", async () => {
  assert.equal((await hydrateReviewCampaigns(fixture({}), [review]))[0].campaignHeaderId, null);
  const db = fixture({ campaign_headers: [{ id: "one", quotation_id: "quote" }, { id: "two", quotation_id: "quote" }] });
  assert.equal((await hydrateReviewCampaigns(db, [review]))[0].campaignHeaderId, null);
});

test("existing review campaign is preserved", async () => {
  const linked = { ...review, campaignHeaderId: "original" };
  assert.equal((await hydrateReviewCampaigns(fixture({}), [linked]))[0], linked);
});
