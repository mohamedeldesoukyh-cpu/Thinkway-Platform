import assert from "node:assert/strict";
import { test } from "node:test";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import {
  buildQuotationConvertUnits,
  isSelectedQuotationOption,
  summarizeQuotationConvertSelection,
} from "./quotation-convert-selection";

function item(partial: Partial<QuotationItemRow> & { id: string }): QuotationItemRow {
  return {
    id: partial.id,
    influencer_id: partial.influencer_id ?? "inf-1",
    profile_id: null,
    unified_id: partial.unified_id ?? "u1",
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
    cost: partial.cost ?? 100,
    cost_currency: "EGP",
    revenue: partial.revenue ?? 200,
    gp_pct: 50,
    gp_value: 100,
    fx_rate_to_egp: 1,
    cost_egp: partial.cost ?? 100,
    revenue_egp: partial.revenue ?? 200,
    gp_value_egp: 100,
    af_pct: 0,
    af_value: 0,
    af_value_egp: 0,
    option_number: partial.option_number ?? 1,
    service_description: null,
    collapse_group_id: partial.collapse_group_id ?? null,
    collapse_label: partial.collapse_label ?? null,
    sort_order: partial.sort_order ?? 1,
  };
}

test("isSelectedQuotationOption: null and 1 selected; 2+ alternatives", () => {
  assert.equal(isSelectedQuotationOption(null), true);
  assert.equal(isSelectedQuotationOption(1), true);
  assert.equal(isSelectedQuotationOption(2), false);
});

test("buildQuotationConvertUnits skips alternative options", () => {
  const units = buildQuotationConvertUnits([
    item({ id: "a", option_number: 1, sort_order: 1 }),
    item({ id: "b", option_number: 2, sort_order: 2, unified_id: "u1" }),
  ]);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.primaryItem.id, "a");
});

test("buildQuotationConvertUnits: one package → one unit with members", () => {
  const units = buildQuotationConvertUnits([
    item({
      id: "leader",
      collapse_group_id: "pkg-1",
      sort_order: 1,
      influencer_id: "inf-a",
      unified_id: "ua",
      revenue: 500,
    }),
    item({
      id: "member",
      collapse_group_id: "pkg-1",
      sort_order: 2,
      influencer_id: "inf-b",
      unified_id: "ub",
      revenue: 0,
      cost: 0,
    }),
  ]);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.kind, "package");
  assert.equal(units[0]?.primaryItem.id, "leader");
  assert.equal(units[0]?.memberItems.length, 2);
});

test("summarizeQuotationConvertSelection counts skipped alternatives", () => {
  const summary = summarizeQuotationConvertSelection([
    item({ id: "a", option_number: 1 }),
    item({ id: "b", option_number: 2, unified_id: "u1" }),
  ]);
  assert.equal(summary.unitCount, 1);
  assert.equal(summary.skippedAlternativeCount, 1);
});
