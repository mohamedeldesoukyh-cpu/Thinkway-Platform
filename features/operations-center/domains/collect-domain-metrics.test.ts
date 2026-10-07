import assert from "node:assert/strict";
import test from "node:test";
import type {SupabaseClient} from "@supabase/supabase-js";
import {collectDiscoveryMetrics} from "./collect-domain-metrics";
function client(count:number|null,error:object|null=null){
 return {from:(table:string)=>({select:()=>({count:table==="influencers"?count:7480,error:table==="influencers"?error:null,order:()=>({limit:()=>({maybeSingle:async()=>({data:null,error:null})})})})})} as unknown as SupabaseClient;
}
test("failed creator query does not manufacture healthy DNA coverage",async()=>{
 const cards=await collectDiscoveryMetrics(client(null,{code:"42501"}),[]);
 assert.match(cards.find(c=>c.id==="creator-count")!.reason!,/permissions/);
 assert.equal(cards.find(c=>c.id==="dna-coverage")!.status,"unknown");
 assert.equal(cards.find(c=>c.id==="dna-coverage")!.value,"—");
 assert.equal(cards.find(c=>c.id==="dna-count")!.value,7480);
 assert.equal(cards.find(c=>c.id==="dna-count")!.status,"healthy");
});
test("empty and missing counts remain distinct; coverage needs a denominator",async()=>{
 for(const count of [0,null]){
  const cards=await collectDiscoveryMetrics(client(count),[]);
  assert.equal(cards.find(c=>c.id==="creator-count")!.value,count===0?0:"—");
  assert.equal(cards.find(c=>c.id==="dna-coverage")!.status,"unknown");
 }
 const cards=await collectDiscoveryMetrics(client(10000),[]);
 assert.equal(cards.find(c=>c.id==="dna-coverage")!.value,"75% (7480)");
});
