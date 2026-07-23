import assert from "node:assert/strict";

import {
  selectedItemsCanCollapse,
  selectedItemsCanUncollapse,
} from "@/features/discovery/shortlists/shortlist-collapse-groups";
import type { ShortlistCreatorItem } from "@/features/discovery/shortlists/types";
import { buildQuotationWorkspaceDisplayGroups } from "@/lib/quotations/quotation-collapse-groups";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

function mockShortlistItem(
  itemId: string,
  overrides: Partial<ShortlistCreatorItem> = {}
): ShortlistCreatorItem {
  return {
    item_id: itemId,
    item_status: "draft",
    notes: null,
    match_score: null,
    unified_id: itemId,
    profile_id: null,
    influencer_id: null,
    platform_account_ids: [],
    creator: null,
    quotation_refs: [],
    collapse_group_id: null,
    collapse_label: null,
    ...overrides,
  };
}

{
  assert.equal(
    selectedItemsCanCollapse([
      mockShortlistItem("a"),
      mockShortlistItem("b"),
    ]),
    true
  );
  assert.equal(
    selectedItemsCanCollapse([
      mockShortlistItem("a"),
      mockShortlistItem("b"),
      mockShortlistItem("c"),
    ]),
    true
  );
  assert.equal(
    selectedItemsCanCollapse([
      mockShortlistItem("a", { collapse_group_id: "g1", collapse_label: "Collap" }),
      mockShortlistItem("b", { collapse_group_id: "g1", collapse_label: "Collap" }),
    ]),
    false
  );
  assert.equal(
    selectedItemsCanCollapse([
      mockShortlistItem("a", { collapse_group_id: "g1", collapse_label: "Collap" }),
      mockShortlistItem("b", { collapse_group_id: "g1", collapse_label: "Collap" }),
      mockShortlistItem("c"),
    ]),
    true
  );
  assert.equal(
    selectedItemsCanUncollapse([
      mockShortlistItem("a", { collapse_group_id: "g1", collapse_label: "Collap" }),
    ]),
    true
  );
  assert.equal(
    selectedItemsCanUncollapse([mockShortlistItem("a")]),
    false
  );
}

function mockQuotationItem(
  id: string,
  overrides: Partial<QuotationItemRow> = {}
): QuotationItemRow {
  return {
    id,
    influencer_id: null,
    profile_id: null,
    unified_id: id,
    source_shortlist_item_id: null,
    creator_name: `Creator ${id}`,
    platform: "instagram",
    handle: `@${id}`,
    followers: 1000,
    engagement_rate: 2,
    country_code: "EG",
    deliverables: [],
    profile_image_url: null,
    profile_url: null,
    option_number: 1,
    service_description: null,
    commercial_input_mode: "cost_gp_pct",
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
    sort_order: 0,
    collapse_group_id: null,
    collapse_label: null,
    ...overrides,
  };
}

{
  const groups = buildQuotationWorkspaceDisplayGroups([
    mockQuotationItem("1", { collapse_group_id: "cg", collapse_label: "Collap", sort_order: 1 }),
    mockQuotationItem("2", {
      unified_id: "two",
      creator_name: "Creator two",
      handle: "@two",
      collapse_group_id: "cg",
      collapse_label: "Collap",
      sort_order: 2,
    }),
    mockQuotationItem("3", { unified_id: "solo", sort_order: 3 }),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.kind, "collapse");
  if (groups[0]?.kind === "collapse") {
    assert.equal(groups[0].label, "Collap");
    assert.equal(groups[0].creatorGroups.length, 2);
  }
  assert.equal(groups[1]?.kind, "creator");
}

console.log("collapse-content.test.ts: ok");
