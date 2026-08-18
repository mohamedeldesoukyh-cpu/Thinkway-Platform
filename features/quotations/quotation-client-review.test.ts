import assert from "node:assert/strict";
import { test } from "node:test";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import {
  clientSelectionForItem,
  countQuotationClientSelections,
  filterItemsByClientSelection,
  itemIdsForClientSelection,
  totalsForClientSelection,
} from "./quotation-client-review";

function item(partial: Partial<QuotationItemRow> & { id: string }): QuotationItemRow {
  return {
    id: partial.id,
    influencer_id: partial.influencer_id ?? null,
    profile_id: partial.profile_id ?? null,
    unified_id: partial.unified_id ?? null,
    source_shortlist_item_id: null,
    creator_name: partial.creator_name ?? "Creator",
    platform: "instagram",
    handle: "@c",
    followers: 1000,
    engagement_rate: 1,
    country_code: "EG",
    profile_image_url: null,
    profile_url: null,
    deliverables: [],
    commercial_input_mode: "cost_revenue",
    cost: 100,
    cost_currency: "EGP",
    revenue: 200,
    gp_pct: 50,
    gp_value: 100,
    fx_rate_to_egp: 1,
    cost_egp: partial.cost_egp ?? 100,
    revenue_egp: partial.revenue_egp ?? 200,
    gp_value_egp: partial.gp_value_egp ?? 100,
    af_pct: 0,
    af_value: 0,
    af_value_egp: 0,
    option_number: 1,
    service_description: null,
    collapse_group_id: null,
    collapse_label: null,
    sort_order: 1,
  };
}

test("quotation client selection maps unified ids to accepted / under review / rejected", () => {
  const a = item({ id: "1", unified_id: "u-a", creator_name: "A" });
  const b = item({ id: "2", influencer_id: "inf-b", creator_name: "B" });
  const c = item({ id: "3", unified_id: "u-c", creator_name: "C" });
  const selection = { "u-a": "accepted" as const, "inf:inf-b": "in_review" as const, "u-c": "rejected" as const };
  assert.equal(clientSelectionForItem(a, selection), "accepted");
  assert.equal(clientSelectionForItem(b, selection), "in_review");
  assert.equal(clientSelectionForItem(c, selection), "rejected");
  const counts = countQuotationClientSelections([a, b, c], selection);
  assert.equal(counts.accepted, 1);
  assert.equal(counts.inReview, 1);
  assert.equal(counts.rejected, 1);
  assert.deepEqual(filterItemsByClientSelection([a, b, c], selection, "accepted").map((row) => row.id), ["1"]);
  assert.deepEqual(itemIdsForClientSelection([a, b, c], selection, "accepted"), ["1"]);
});

test("approved quotation totals use only accepted creator lines", () => {
  const a = item({ id: "1", unified_id: "u-a", cost_egp: 40, revenue_egp: 100, gp_value_egp: 60 });
  const b = item({ id: "2", unified_id: "u-b", cost_egp: 80, revenue_egp: 200, gp_value_egp: 120 });
  const totals = totalsForClientSelection([a, b], { "u-a": "accepted", "u-b": "in_review" }, "accepted");
  assert.equal(totals.creatorCount, 1);
  assert.equal(totals.costEgp, 40);
  assert.equal(totals.revenueEgp, 100);
  assert.equal(totals.gpValueEgp, 60);
  assert.equal(totals.gpPct, 60);
});
