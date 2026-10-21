import assert from "node:assert/strict";
import { test } from "node:test";
import type { QuotationItemRow } from "@/features/quotations/types";
import { moveCreator, orderCreatorGroups, orderQuotationItems, quotationOrderCreators, readCreatorListOrder } from "./quotation-creator-order";
const item = (id: string, creator: string, rank: number, followers: number) => ({ id, unified_id: creator, creator_name: creator, sort_order: rank, followers, revenue: 1200, af_value: 120 } as QuotationItemRow);
test("default order uses largest platform tier, keeps services together and puts UGC last", () => {
  const nano = item("n", "Nano", 0, 2000);
  const mega = { ...item("m", "Mega", 1, 2000), creator_profile_source: { platformAccounts: [{ platform: "tiktok", followers: 2000000 }] } } as QuotationItemRow;
  const ugc = { ...item("u", "UGC", 2, 3000000), creator_categories: ["UGC"] };
  const macro = item("a", "Macro", 3, 600000);
  const megaService = { ...mega, id: "m2", sort_order: 4 };
  const rows = [nano, mega, ugc, macro, megaService];
  assert.deepEqual(quotationOrderCreators(rows).flatMap(g => g.items.map(i => i.id)), ["m", "m2", "a", "n", "u"]);
  assert.deepEqual(quotationOrderCreators(rows, ["u", "n", "a", "m"]).map(g => g.name), ["UGC", "Nano", "Macro", "Mega"]);
  assert.deepEqual(rows.map(i => i.id), ["n", "m", "u", "a", "m2"]);
});
test("custom creator order keeps options and money intact, including new creators", () => {
  const rows = [item("a1", "Alpha", 0, 2000000), item("b1", "Beta", 1, 15000), item("a2", "Alpha", 2, 2000000), item("c1", "Gamma", 3, 500)];
  const before = structuredClone(rows);
  const order = ["b1", "a1", "a2"];
  const groups = quotationOrderCreators(rows, order);
  assert.deepEqual(groups.map(g => g.name), ["Beta", "Alpha", "Gamma"]);
  assert.deepEqual(groups[1].items.map(i => i.id), ["a1", "a2"]);
  const ordered = orderQuotationItems(rows, order);
  assert.deepEqual(ordered.map(i => i.id), ["b1", "a1", "a2", "c1"]);
  assert.equal(ordered.reduce((sum, i) => sum + i.revenue + i.af_value, 0), 5280);
  assert.deepEqual(rows, before);
  assert.ok(ordered.every(row => rows.includes(row)));
  assert.deepEqual(quotationOrderCreators(rows).map(g => g.name), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(quotationOrderCreators(rows, []).map(g => g.name), ["Alpha", "Beta", "Gamma"]);
});
test("saved member ranks apply to filtered groups; absent/deleted IDs do not hide or duplicate creators", () => {
  const groups = [{ ids: ["a2"] }, { ids: ["b1"] }, { ids: ["new"] }];
  assert.deepEqual(orderCreatorGroups(groups, ["deleted", "b1", "a1", "a2"], g => g.ids), [groups[1], groups[0], groups[2]]);
  assert.deepEqual(orderCreatorGroups(groups, undefined, g => g.ids), groups);
});
test("malformed metadata is ignored and position moves are bounded", () => {
  assert.deepEqual(readCreatorListOrder(null), []);
  assert.deepEqual(readCreatorListOrder({creatorListOrder: "a"}), []);
  assert.deepEqual(readCreatorListOrder({creatorListOrder: ["b", 3, "", "a", "b"]}), ["b", "a"]);
  const rows = ["A", "B", "C"];
  assert.deepEqual(moveCreator(rows, 2, 0), ["C", "A", "B"]);
  assert.deepEqual(moveCreator(rows, 0, 99), ["B", "C", "A"]);
  assert.deepEqual(moveCreator(rows, 1, -9), ["B", "A", "C"]);
  assert.deepEqual(moveCreator(rows, 10, 0), rows);
  assert.deepEqual(moveCreator(rows, 0.5, 0), rows);
  assert.deepEqual(rows, ["A", "B", "C"]);
});
