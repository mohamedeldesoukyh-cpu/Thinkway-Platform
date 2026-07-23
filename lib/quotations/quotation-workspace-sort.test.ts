import assert from "node:assert/strict";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  applyQuotationWorkspaceHeaderSort,
  buildCreatorGroupsFromSortedItems,
  sortQuotationWorkspaceItems,
} from "@/lib/quotations/quotation-workspace-sort";

function item(
  partial: Partial<QuotationItemRow> & Pick<QuotationItemRow, "id" | "sort_order">
): QuotationItemRow {
  return {
    source_shortlist_item_id: null,
    profile_image_url: null,
    profile_url: null,
    creator_name: "Creator",
    handle: null,
    platform: "instagram",
    service_description: "",
    followers: 0,
    country_code: null,
    deliverables: [],
    commercial_input_mode: "cost_markup_pct",
    cost: 0,
    cost_currency: "EGP",
    revenue: 0,
    gp_pct: 0,
    gp_value: 0,
    fx_rate_to_egp: 1,
    cost_egp: 0,
    revenue_egp: 0,
    gp_value_egp: 0,
    af_pct: 0,
    af_value: 0,
    af_value_egp: 0,
    option_number: 1,
    unified_id: null,
    influencer_id: null,
    profile_id: null,
    engagement_rate: null,
    ...partial,
  };
}

{
  const toggled = applyQuotationWorkspaceHeaderSort(
    { field: "followers", direction: "desc" },
    "followers"
  );
  assert.equal(toggled.direction, "asc");
}

{
  const items = [
    item({ id: "a", sort_order: 1, followers: 1000, creator_name: "Alpha" }),
    item({ id: "b", sort_order: 2, followers: 50000, creator_name: "Beta" }),
    item({ id: "c", sort_order: 3, followers: 10000, creator_name: "Gamma" }),
  ];
  const sorted = sortQuotationWorkspaceItems(
    items,
    { field: "followers", direction: "desc" },
    { drafts: {} }
  );
  assert.deepEqual(
    sorted.map((row) => row.id),
    ["b", "c", "a"]
  );
}

{
  const items = [
    item({
      id: "a",
      sort_order: 1,
      unified_id: "inf:1",
      creator_name: "Same",
      revenue_egp: 100,
    }),
    item({
      id: "b",
      sort_order: 2,
      unified_id: "inf:2",
      creator_name: "Other",
      revenue_egp: 500,
    }),
    item({
      id: "c",
      sort_order: 3,
      unified_id: "inf:1",
      creator_name: "Same",
      option_number: 2,
      revenue_egp: 200,
    }),
  ];
  const sorted = sortQuotationWorkspaceItems(
    items,
    { field: "price", direction: "desc" },
    { drafts: {} }
  );
  const groups = buildCreatorGroupsFromSortedItems(sorted);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.creatorKey, "u:inf:2");
  assert.deepEqual(
    groups[1]?.items.map((row) => row.id),
    ["c", "a"]
  );
}

console.log("quotation-workspace-sort tests passed");
