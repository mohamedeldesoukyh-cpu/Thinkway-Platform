import assert from "node:assert/strict";

import {
  buildDuplicatedShortlistInsert,
  duplicateShortlistName,
  mapDuplicatedShortlistItems,
  type ShortlistItemDuplicateSource,
} from "@/features/discovery/shortlists/duplicate-shortlist";

assert.equal(duplicateShortlistName("Cofftea Egypt"), "Cofftea Egypt (copy)");
assert.equal(duplicateShortlistName("Cofftea Egypt (copy)"), "Cofftea Egypt (copy 2)");
assert.equal(duplicateShortlistName("Cofftea Egypt (copy 2)"), "Cofftea Egypt (copy 3)");
assert.equal(duplicateShortlistName("  "), "Shortlist (copy)");

const source: ShortlistItemDuplicateSource[] = [
  {
    profile_id: "p1",
    influencer_id: "inf-1",
    unified_id: "u1",
    notes: "Hero",
    match_score: 88,
    sort_order: 1,
    platform_account_ids: ["ig-1"],
    commercial_input_mode: "cost_gp_pct",
    cost: 1000,
    cost_currency: "EGP",
    gp_pct: 25,
    gp_value: 333.33,
    revenue: 1333.33,
    fx_rate_to_egp: 1,
    cost_egp: 1000,
    revenue_egp: 1333.33,
    gp_value_egp: 333.33,
    deliverables: [{ platform: "instagram", type: "instagram_reel", quantity: 1 }],
    commercial_updated_at: "2026-08-01T00:00:00Z",
    option_number: 1,
    service_description: "1× IG Reel",
    collapse_group_id: "cg-old",
    collapse_label: "Collap",
  },
  {
    profile_id: "p2",
    influencer_id: "inf-2",
    unified_id: "u2",
    notes: null,
    match_score: null,
    sort_order: 2,
    platform_account_ids: [],
    commercial_input_mode: "cost_gp_pct",
    cost: 500,
    cost_currency: "EGP",
    gp_pct: 20,
    gp_value: 125,
    revenue: 625,
    fx_rate_to_egp: 1,
    cost_egp: 500,
    revenue_egp: 625,
    gp_value_egp: 125,
    deliverables: [],
    commercial_updated_at: null,
    option_number: 1,
    service_description: null,
    collapse_group_id: "cg-old",
    collapse_label: "Collap",
  },
];

let groupSeq = 0;
const mapped = mapDuplicatedShortlistItems(source, "sl-new", "user-1", () => {
  groupSeq += 1;
  return `cg-new-${groupSeq}`;
});

assert.equal(mapped.length, 2);
assert.equal(mapped[0]?.shortlist_id, "sl-new");
assert.equal(mapped[0]?.added_by, "user-1");
assert.equal(mapped[0]?.item_status, "draft");
assert.equal(mapped[0]?.cost, 1000);
assert.equal(mapped[0]?.service_description, "1× IG Reel");
assert.equal(mapped[0]?.collapse_group_id, "cg-new-1");
assert.equal(mapped[1]?.collapse_group_id, "cg-new-1", "collapse members share the remapped group");
assert.notEqual(mapped[0]?.collapse_group_id, "cg-old");
assert.deepEqual(mapped[0]?.deliverables, source[0]?.deliverables);

const header = buildDuplicatedShortlistInsert(
  {
    name: "Cofftea Egypt",
    description: "Roster",
    visibility: "team",
    client_id: "c1",
    brand_id: "b1",
    metadata: { currency: "EGP", hideCostAndFees: true },
  },
  "user-1"
);
assert.equal(header.name, "Cofftea Egypt (copy)");
assert.equal(header.status, "draft");
assert.equal(header.client_id, "c1");
assert.equal(header.brand_id, "b1");
assert.equal((header.metadata as { currency?: string }).currency, "EGP");
assert.equal("currency" in header, false, "Production has no discovery_shortlists.currency column");
assert.equal("quotation_id" in header, false, "Duplicate must not copy quotations");
assert.equal("campaign_header_id" in header, false);

console.log("duplicate-shortlist.test.ts: all assertions passed");
