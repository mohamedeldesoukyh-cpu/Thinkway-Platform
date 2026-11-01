import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCreatorItemSelection, seedCreatorItemSelection, toggleCreatorItems } from "./creator-item-selection";
import { quotationLineOptions } from "./quotation-line-options";
import { summarizeQuotationSelection } from "./document-selection-summary";
import type { DocumentCreatorOption } from "./document-creator-selection-dialog";
import type { QuotationItemRow } from "@/features/quotations/types";

const creators: DocumentCreatorOption[] = [
  {creatorKey:"a", name:"Alpha", handle:"alpha", itemIds:["a1","a2"], lineOptions:[
    {key:"a1",label:"Option 1",description:"Reel",itemIds:["a1"]},
    {key:"a2",label:"Option 2",description:"Story",itemIds:["a2"]},
  ]},
  {creatorKey:"b", name:"Beta", handle:"beta", itemIds:["b1"]},
];

test("opening and switching proposal options preserves exact line IDs", () => {
  assert.deepEqual([...seedCreatorItemSelection(creators,["a2"])],["a2"]);
  const first = toggleCreatorItems(seedCreatorItemSelection(creators),["a1"]);
  const second = normalizeCreatorItemSelection(creators,["a1"]);
  assert.deepEqual([...second],["a1"]);
  assert.deepEqual([...normalizeCreatorItemSelection(creators,[...first])],["a2","b1"]);
  assert.equal(normalizeCreatorItemSelection(creators,[]).size,0);
  assert.equal(seedCreatorItemSelection(creators,["deleted"]).size,0);
});

test("parent select-all fills partial selection and select-none clears it", () => {
  const selected = toggleCreatorItems(new Set(["a2","b1"]),["a1","a2"]);
  assert.equal(selected.size,3);
  assert.deepEqual([...toggleCreatorItems(selected,["a1","a2"])],["b1"]);
});

test("choosing only one option excludes the other price from totals", () => {
  const items=[
    {id:"a1",unified_id:"a",revenue_egp:1000,cost_egp:500},
    {id:"a2",unified_id:"a",revenue_egp:2500,cost_egp:1500},
  ] as QuotationItemRow[];
  const summary=summarizeQuotationSelection(items,[...seedCreatorItemSelection(creators,["a2"])]);
  assert.equal(summary.selectedCreatorCount,1);
  assert.equal(summary.metrics.find(metric=>metric.label==="Client cost")?.value,"EGP 2,500");
});

test("line choices follow workspace ordering and packages retain all priced members", () => {
  const items=[
    {id:"a2",unified_id:"a",sort_order:2,option_number:1,deliverables:[],service_description:"Story"},
    {id:"a1",unified_id:"a",sort_order:1,option_number:1,deliverables:[],service_description:"Reel"},
    {id:"p1",unified_id:"c",sort_order:3,collapse_group_id:"package",creator_name:"Charlie",deliverables:[],service_description:"Joint reel"},
    {id:"p2",unified_id:"d",sort_order:4,collapse_group_id:"package",creator_name:"Delta",deliverables:[]},
  ] as QuotationItemRow[];
  const choices=quotationLineOptions(items);
  assert.equal(choices.get("a1")?.label,"Option 1");
  assert.equal(choices.get("a2")?.label,"Option 2");
  assert.equal(choices.get("a2")?.description,"Story");
  assert.deepEqual(choices.get("p2")?.itemIds,["p1","p2"]);
  assert.equal(choices.get("p2")?.description,"Joint reel");
  const packaged = items.map(item=>({creatorKey:item.id,name:item.id,handle:item.id,itemIds:[item.id],lineOptions:[choices.get(item.id)!]}));
  assert.deepEqual([...seedCreatorItemSelection(packaged,["p2"])].sort(),["p1","p2"]);
  assert.equal(toggleCreatorItems(new Set(["p1","p2"]),choices.get("p2")!.itemIds).size,0);
});
