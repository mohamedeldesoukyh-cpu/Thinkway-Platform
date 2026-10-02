import assert from "node:assert/strict";
import {test} from "node:test";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database";
import {createSupabaseCommercialSyncPorts} from "@/lib/services/commercial/supabase-ports";
import type {RateCardWriteSnapshot} from "./model";

function harness(){
 let row:Record<string,unknown>={id:"item",cost:80,revenue:160,cost_currency:"EGP",commercial_input_mode:"cost_revenue",gp_pct:50,gp_value:80,af_pct:5,fx_rate_to_egp:1,deliverables:[{platform:"instagram",type:"instagram_reel",quantity:1,cost:80,revenue:160}],rate_card_sources:{}};
 const original=structuredClone(row);
 const db={from(){let patch:Record<string,unknown>|null=null;const filters:[string,unknown][]=[];const chain={select(){if(!patch)return chain;const matches=filters.every(([key,value])=>key==="deliverables"?JSON.stringify(row[key])===value:row[key]===value);if(matches)row={...row,...patch};return Promise.resolve({error:null,data:matches?[{id:"item"}]:[]});},update(value:Record<string,unknown>){patch=value;return chain;},eq(key:string,value:unknown){filters.push([key,value]);return chain;},is(key:string,value:unknown){filters.push([key,value]);return chain;},maybeSingle(){return Promise.resolve({data:structuredClone(row),error:null});},single(){return Promise.resolve({data:structuredClone(row),error:null});}};return chain;}} as unknown as SupabaseClient<Database>;
 const snapshot:RateCardWriteSnapshot={quotationItemId:"item",deliverables:[{platform:"instagram",type:"instagram_reel",quantity:1,cost:100,revenue:200}],sources:{"0:creator_cost":{card_id:"card",version_id:"v1",name:"Card",version:"V1",amount:100,currency:"EGP",applied_at:"2026-10-02",applied_by:"user",price_type:"creator_cost"}},expectedDeliverables:original.deliverables as RateCardWriteSnapshot["deliverables"],expectedCost:80,expectedRevenue:160,expectedCurrency:"EGP"};
 return {db,snapshot,original,get:()=>row,set:(patch:Record<string,unknown>)=>{row={...row,...patch};}};
}
const values={creator_cost:100,client_revenue:200,cost_currency:"EGP",exchange_rate:1,commercial_input_mode:"cost_revenue" as const,agency_fee_percent:10};
test("linked quotation writes amounts, deliverables and historical source in the same update",async()=>{
 const h=harness(),ports=createSupabaseCommercialSyncPorts(h.db,h.snapshot);await ports.writeQuotationMaster("item",values);
 assert.equal(h.get().cost,100);assert.equal(h.get().revenue,200);assert.deepEqual(h.get().deliverables,h.snapshot.deliverables);assert.deepEqual(h.get().rate_card_sources,h.snapshot.sources);
});
test("linked snapshot rejects a stale quote without compensating over the new edit",async()=>{
 const h=harness();h.set({revenue:175});const ports=createSupabaseCommercialSyncPorts(h.db,h.snapshot);
 await assert.rejects(()=>ports.runInTransaction(()=>ports.writeQuotationMaster("item",values)),/stale/);assert.equal(h.get().revenue,175);assert.deepEqual(h.get().rate_card_sources,{});
});
test("existing sync compensation restores rate sources and deliverables if campaign sync fails",async()=>{
 const h=harness(),ports=createSupabaseCommercialSyncPorts(h.db,h.snapshot);
 await assert.rejects(()=>ports.runInTransaction(async()=>{await ports.writeQuotationMaster("item",values);throw new Error("campaign-write-failed");}),/campaign-write-failed/);
 assert.equal(h.get().cost,80);assert.equal(h.get().revenue,160);assert.deepEqual(h.get().deliverables,h.original.deliverables);assert.deepEqual(h.get().rate_card_sources,{});
});

