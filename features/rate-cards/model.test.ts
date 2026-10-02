import assert from "node:assert/strict";
import { test } from "node:test";
import { previewApplication, validateImportRow, headerSchema, type RateLine, type MatchItem } from "./model";
const ref="inf:00000000-0000-4000-8000-000000000001";
const rate:RateLine={id:"r1",version_id:"v1",creator_ref:ref,creator_name:"Creator",platform:"instagram",deliverable:"instagram_reel",amount:100000,currency:"EGP",notes:"",price_type:"creator_cost",agency_fee_percent:null};
const item:MatchItem={id:"i1",unified_id:ref,creator_name:"Creator",deliverables:[{platform:"instagram",type:"instagram_reel",quantity:1,cost:105000,cost_currency:"EGP"}]};
test("preview is pure, preserves a zero and never matches by name",()=>{
 const before=structuredClone(item);
 assert.equal(previewApplication([item],[rate],"missing")[0].status,"unchanged");
 const zero={...item,deliverables:[{...item.deliverables[0],cost:0}]};
 assert.equal(previewApplication([zero],[rate],"missing")[0].status,"unchanged");
 assert.equal(previewApplication([{...item,unified_id:"other"}],[rate],"overwrite")[0].status,"no_match");
 assert.deepEqual(item,before);
});
test("overwrite requires exact creator + platform + deliverable and refuses ambiguous packages",()=>{
 assert.equal(previewApplication([item],[rate],"overwrite")[0].after,100000);
 for(const patch of [{platform:"tiktok"},{type:"instagram_story"},{types:["instagram_reel","instagram_story"]}]) assert.equal(previewApplication([{...item,deliverables:[{...item.deliverables[0],...patch}]}],[rate],"overwrite")[0].status,"no_match");
 assert.equal(previewApplication([item],[rate,{...rate,id:"r2"}],"overwrite")[0].status,"no_match");
});
test("missing detail never overwrites a line-master value",()=>{
 const base={...item,cost:95000,deliverables:[{...item.deliverables[0],cost:null}]};
 assert.equal(previewApplication([base],[rate],"missing")[0].status,"unchanged");
 assert.equal(previewApplication([{...base,cost:null}],[rate],"missing")[0].status,"fill");
});
test("individual application is restricted to exactly one selected row",()=>{
 const rows=[{...item,deliverables:[item.deliverables[0],item.deliverables[0]]},{...item,id:"i2"}];
 assert.deepEqual(previewApplication(rows,[rate],"overwrite",{item_id:"i1",index:1}).map(r=>[r.item_id,r.index]),[["i1",1]]);
});
test("snapshot values survive later edits/removal of master rates",()=>{
 const mutable={...rate};const preview=previewApplication([item],[mutable],"overwrite");mutable.amount=120000;
 assert.equal(preview[0].after,100000);assert.equal(previewApplication([item],[],"overwrite")[0].status,"no_match");
});
const raw={"Rate Type":"creator_cost","Creator Name":"Creator","Platform":"instagram","Deliverable Type":"instagram_reel",Rate:"100000",Currency:"EGP"};
test("upload validates taxonomy, numeric input, currency, identity, and duplicate keys",()=>{
 const match={ref,name:"Creator"};const seen=new Set<string>();
 assert.equal(validateImportRow(2,raw,match,["EGP"],seen).status,"ready");
 assert.equal(validateImportRow(3,raw,match,["EGP"],seen).issues[0],"duplicate");
 for(const patch of [{Rate:""},{Rate:"-1"},{Rate:"Infinity"},{Rate:"100,000"},{Platform:"tiktok"},{Currency:"BAD"}]) assert.equal(validateImportRow(2,{...raw,...patch},match,["EGP"],new Set()).status,"error");
 assert.equal(validateImportRow(2,raw,null,["EGP"],new Set()).status,"unmatched");
 assert.equal(validateImportRow(2,{...raw,Rate:"0"},match,["EGP"],new Set()).status,"ready");
 assert.equal(validateImportRow(2,{...raw,"Creator Name":"Similar name"},match,["EGP"],new Set()).status,"warning");
});
test("invalid effective/expiry ordering is rejected",()=>{
 assert.equal(headerSchema.safeParse({client_id:ref.slice(4),brand_id:null,name:"Card",version:"V1",status:"active",effective_date:"2026-10-02",expiry_date:"2026-10-01",notes:""}).success,false);
});
