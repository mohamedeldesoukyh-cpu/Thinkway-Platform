import assert from "node:assert/strict";
import test from "node:test";

import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

import {
  buildQuotationItemOptionContext,
  groupQuotationItemsByCreator,
  isSameQuotationCreator,
  nextQuotationOptionNumber,
  quotationCreatorDuplicateKey,
  quotationOptionSelectValues,
  quotationOptionRowShadeClass,
} from "./quotation-creator-options";

function item(
  partial: Partial<QuotationItemRow> & Pick<QuotationItemRow, "id">
): QuotationItemRow {
  return {
    influencer_id: null,
    profile_id: null,
    unified_id: null,
    source_shortlist_item_id: null,
    creator_name: "Creator",
    platform: "instagram",
    handle: "@c",
    followers: 1000,
    engagement_rate: null,
    country_code: null,
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
    ...partial,
  };
}

test("isSameQuotationCreator matches unified_id", () => {
  const a = item({ id: "a", unified_id: "u-1" });
  const b = item({ id: "b", unified_id: "u-1" });
  assert.equal(isSameQuotationCreator(a, b), true);
});

test("nextQuotationOptionNumber increments per creator siblings", () => {
  assert.equal(
    nextQuotationOptionNumber([{ option_number: 1 }, { option_number: 2 }]),
    3
  );
  assert.equal(nextQuotationOptionNumber([{ option_number: null }]), 1);
});

test("buildQuotationItemOptionContext sequences Option 1, 2, 3 in sort order", () => {
  const context = buildQuotationItemOptionContext([
    item({ id: "a1", unified_id: "u-1", option_number: 1, sort_order: 1 }),
    item({ id: "a2", unified_id: "u-1", option_number: 1, sort_order: 2 }),
    item({ id: "a3", unified_id: "u-1", option_number: 1, sort_order: 3 }),
    item({ id: "b1", unified_id: "u-2", option_number: 1, sort_order: 4 }),
  ]);

  assert.equal(context.get("a1")?.optionNumber, 1);
  assert.equal(context.get("a2")?.optionNumber, 2);
  assert.equal(context.get("a3")?.optionNumber, 3);
  assert.equal(context.get("a2")?.showOptionLabel, true);
  assert.equal(context.get("b1")?.showOptionLabel, false);
});

test("buildQuotationItemOptionContext matches duplicate creator names", () => {
  const context = buildQuotationItemOptionContext([
    item({ id: "a1", unified_id: "u-jane", creator_name: "Jane", handle: "@jane", sort_order: 1 }),
    item({ id: "a2", unified_id: "u-jane", creator_name: "Jane", handle: "@jane", sort_order: 2 }),
  ]);

  assert.equal(context.get("a1")?.optionNumber, 1);
  assert.equal(context.get("a2")?.optionNumber, 2);
});

test("groupQuotationItemsByCreator nests options under each creator", () => {
  const groups = groupQuotationItemsByCreator([
    item({ id: "a1", unified_id: "u-1", option_number: 1, sort_order: 1 }),
    item({ id: "a2", unified_id: "u-1", option_number: 2, sort_order: 2 }),
    item({ id: "b1", unified_id: "u-2", option_number: 1, sort_order: 3 }),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.optionSets.length, 2);
  assert.equal(groups[0]?.optionSets[0]?.optionNumber, 1);
  assert.equal(groups[0]?.optionSets[1]?.optionNumber, 2);
  assert.equal(groups[0]?.optionSets[1]?.shadeIndex, 1);
  assert.equal(groups[1]?.optionSets[0]?.optionNumber, 1);
});

test("quotationOptionSelectValues includes blank choices and next slot", () => {
  const values = quotationOptionSelectValues(2, [1, 2]);
  assert.deepEqual(values, [1, 2, 3]);
});

test("manual quotation items with the same placeholder name stay distinct", () => {
  const a = item({ id: "m1", creator_name: "New creator", sort_order: 1 });
  const b = item({ id: "m2", creator_name: "New creator", sort_order: 2 });
  assert.notEqual(quotationCreatorDuplicateKey(a), quotationCreatorDuplicateKey(b));
  assert.equal(isSameQuotationCreator(a, b), false);
});

test("quotationOptionRowShadeClass cycles", () => {
  assert.match(quotationOptionRowShadeClass(0), /bg-background/);
  assert.match(quotationOptionRowShadeClass(1), /border-l-sky/);
});
