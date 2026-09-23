import assert from "node:assert/strict";
import { test } from "node:test";
import { quotationAppendLineId, quotationAppendTargetError, selectQuotationAppendUnit } from "./quotation-append-policy";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

const creator = { id: "first", influencer_id: "creator", sort_order: 0, option_number: 1, source_shortlist_item_id: "shortlist-origin" } as QuotationItemRow;
test("single selection cannot promote an alternative or silently split package pricing", () => {
  const alternative = { ...creator, id: "second", sort_order: 1, option_number: 2 };
  assert.ok(selectQuotationAppendUnit([creator, alternative], [alternative.id]).error);
  assert.ok(selectQuotationAppendUnit([creator], []).error);
  assert.ok(selectQuotationAppendUnit([creator], [creator.id, "missing"]).error);
  assert.ok(selectQuotationAppendUnit([{ ...creator, collapse_group_id: "package" }], [creator.id]).error);
  assert.equal(selectQuotationAppendUnit([creator, alternative], [creator.id]).unit?.primaryItem.id, creator.id);
});
test("target is restricted to accessible open campaigns for the same client and brand", () => {
  const quote = { brand_id: "brand", client_id: "client" };
  assert.equal(quotationAppendTargetError(quote, { ...quote, status: "active" }), null);
  for (const target of [null, { ...quote, status: "completed" }, { ...quote, status: "cancelled" }, { ...quote, brand_id: "other", status: "active" }, { ...quote, client_id: "other", status: "active" }]) {
    assert.ok(quotationAppendTargetError(quote, target));
  }
});
test("retry identity survives quotation revisions and separates campaigns and creators", () => {
  const first = quotationAppendLineId("campaign", creator);
  assert.equal(first, quotationAppendLineId("campaign", { ...creator, id: "new-version-item" }));
  assert.notEqual(first, quotationAppendLineId("other-campaign", creator));
  assert.notEqual(first, quotationAppendLineId("campaign", { id: "different", source_shortlist_item_id: null }));
  assert.match(first, /^[\da-f]{8}-[\da-f]{4}-5[\da-f]{3}-a[\da-f]{3}-[\da-f]{12}$/);
});
