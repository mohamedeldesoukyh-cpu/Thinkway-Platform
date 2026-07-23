import assert from "node:assert/strict";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  buildCollapsePackageOptionRenumberPlan,
  collapsePackageFollowerItems,
  collapsePackageGroupItems,
  collapsePackageLeaderItem,
  collapsePackageOptionNumber,
  countCollapsePackageSiblings,
  isFullCollapsePackageSelection,
  nextCollapsePackageOptionNumber,
  shouldIncludeItemInLiveTotals,
  siblingCollapsePackageMemberIds,
  unionCollapsePackagePlatforms,
} from "./quotation-collapse-package";

function item(partial: Partial<QuotationItemRow> & { id: string }): QuotationItemRow {
  return {
    id: partial.id,
    quotation_id: "q1",
    sort_order: partial.sort_order ?? 0,
    collapse_group_id: partial.collapse_group_id ?? null,
    collapse_label: partial.collapse_label ?? null,
    creator_name: partial.creator_name ?? "Creator",
    handle: partial.handle ?? "@creator",
    platform: partial.platform ?? "instagram",
    deliverables: partial.deliverables ?? [],
    service_description: partial.service_description ?? null,
    revenue: partial.revenue ?? 0,
    cost: partial.cost ?? 0,
    gp_pct: partial.gp_pct ?? 0,
    gp_value: partial.gp_value ?? 0,
    cost_currency: partial.cost_currency ?? "EGP",
    fx_rate_to_egp: partial.fx_rate_to_egp ?? 1,
    af_pct: partial.af_pct ?? 0,
    option_number: partial.option_number ?? 1,
    followers: partial.followers ?? 1000,
    influencer_id: partial.influencer_id ?? null,
    profile_id: partial.profile_id ?? null,
    unified_id: partial.unified_id ?? null,
    creator_categories: partial.creator_categories ?? [],
    creator_profile_source: partial.creator_profile_source ?? null,
    tier: partial.tier ?? null,
    engagement_rate: partial.engagement_rate ?? null,
    manual_creator: partial.manual_creator ?? false,
  } as QuotationItemRow;
}

{
  const group = [
    item({ id: "b", sort_order: 2, collapse_group_id: "g1" }),
    item({ id: "a", sort_order: 1, collapse_group_id: "g1" }),
  ];
  assert.equal(collapsePackageLeaderItem(group).id, "a");
  assert.deepEqual(collapsePackageFollowerItems(group).map((row) => row.id), ["b"]);
  assert.deepEqual(collapsePackageGroupItems(group, "g1").map((row) => row.id), ["a", "b"]);
}

{
  const items = [
    item({ id: "leader", sort_order: 1, collapse_group_id: "g1", revenue: 500 }),
    item({ id: "follower", sort_order: 2, collapse_group_id: "g1", revenue: 300 }),
    item({ id: "solo", sort_order: 3, revenue: 100 }),
  ];
  assert.equal(shouldIncludeItemInLiveTotals(items[0]!, items), true);
  assert.equal(shouldIncludeItemInLiveTotals(items[1]!, items), false);
  assert.equal(shouldIncludeItemInLiveTotals(items[2]!, items), true);
}

{
  const group = [
    item({
      id: "a",
      platform: "instagram",
      creator_profile_source: { linkedPlatforms: ["tiktok"] } as never,
    }),
    item({ id: "b", platform: "youtube" }),
  ];
  assert.deepEqual(unionCollapsePackagePlatforms(group).sort(), [
    "instagram",
    "tiktok",
    "youtube",
  ]);
}

{
  const optionOne = [
    item({ id: "a1", unified_id: "u1", collapse_group_id: "g1", sort_order: 1 }),
    item({ id: "a2", unified_id: "u2", collapse_group_id: "g1", sort_order: 2 }),
  ];
  assert.equal(isFullCollapsePackageSelection(optionOne, ["a1", "a2"]), "g1");
  assert.equal(isFullCollapsePackageSelection(optionOne, ["a1"]), null);
  assert.equal(nextCollapsePackageOptionNumber(optionOne, optionOne), 2);
}

{
  const items = [
    item({ id: "a1", unified_id: "u1", collapse_group_id: "g1", sort_order: 1, option_number: 3 }),
    item({ id: "a2", unified_id: "u2", collapse_group_id: "g1", sort_order: 2, option_number: 1 }),
    item({
      id: "b1",
      unified_id: "u1",
      collapse_group_id: "g2",
      sort_order: 3,
      option_number: 4,
    }),
    item({
      id: "b2",
      unified_id: "u2",
      collapse_group_id: "g2",
      sort_order: 4,
      option_number: 4,
    }),
  ];
  assert.equal(collapsePackageOptionNumber(items, items.slice(0, 2)), 1);
  assert.equal(collapsePackageOptionNumber(items, items.slice(2)), 2);
  assert.equal(countCollapsePackageSiblings(items, items.slice(0, 2)), 2);
  assert.equal(nextCollapsePackageOptionNumber(items, items.slice(0, 2)), 3);
  assert.deepEqual(siblingCollapsePackageMemberIds(items, items.slice(0, 2)).sort(), [
    "a1",
    "a2",
    "b1",
    "b2",
  ]);
}

{
  const items = [
    item({ id: "a1", unified_id: "u1", collapse_group_id: "g1", sort_order: 1, option_number: 3 }),
    item({ id: "a2", unified_id: "u2", collapse_group_id: "g1", sort_order: 2, option_number: 1 }),
  ];
  const plan = buildCollapsePackageOptionRenumberPlan(items);
  assert.deepEqual(plan, [{ id: "a1", option_number: 1 }]);
}
