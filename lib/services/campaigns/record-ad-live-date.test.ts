import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdLiveDate } from "./record-ad-live-date";
const request = { campaignId: "c", scheduleId: "p", liveDate: "2026-10-01", actorId: "user" };
test("manual entry calls atomic package operation without commercial fields", async () => {
  const calls: unknown[]=[];
  const client={rpc:async (...args:unknown[])=>{calls.push(args);return {error:null};}} as unknown as SupabaseClient;
  assert.equal((await recordAdLiveDate(client,request,"2026-10-14")).ok,true);
  assert.deepEqual(calls,[["record_assignment_went_live",{p_campaign:"c",p_schedule:"p",p_date:"2026-10-01"}]]);
});
test("invalid, impossible and future dates never call the database", async () => {
  const client={rpc:()=>{throw Error("must not write");}} as unknown as SupabaseClient;
  for(const liveDate of ["","2026-02-30","2026-10-15","bad"])
    assert.equal((await recordAdLiveDate(client,{...request,liveDate},"2026-10-14")).ok,false);
});
test("authorization and database errors return an actionable form error", async () => {
  const client={rpc:async ()=>({error:{message:"Not authorized to update this campaign"}})} as unknown as SupabaseClient;
  assert.deepEqual(await recordAdLiveDate(client,request,"2026-10-14"),{ok:false,message:"Not authorized to update this campaign"});
});
