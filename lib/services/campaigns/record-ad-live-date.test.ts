import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAdLiveDate } from "./record-ad-live-date";
import { buildPipelineRevenue, type PipelineIo } from "@/lib/analytics/queries/pipeline-revenue";
import { buildRecognitionEvents } from "@/lib/analytics/queries/reporting-financials";
function fixture(overrides: Record<string, unknown> = {}, belongs = true) {
  const post = { id: "p", campaign_line_id: "l", assignment_deliverable_id: "d", live_date: null, locked_at: "invoice-lock", status: "draft", metadata: { keep: true }, ...overrides };
  const writes: { table: string; value: Record<string, unknown> }[] = [];
  const client = { from(table: string) {
    const q = { select() { return q; }, eq() { return q; },
      update(value: Record<string, unknown>) { writes.push({ table, value }); Object.assign(post, value); return q; },
      maybeSingle: async () => ({ data: table === "assignment_post_schedule" ? post : table === "campaign_lines" ? (belongs ? {id:"l"} : null) : {locked_at:"invoice-lock"}, error: null }),
      then(resolve: (result: unknown) => void) { resolve({error:null}); }
    }; return q;
  } } as unknown as SupabaseClient;
  return { client, post, writes };
}
const request = { campaignId: "c", scheduleId: "p", liveDate: "2026-10-01", actorId: "user" };
test("invoiced ad with no actual date can be confirmed without touching commercial or invoice fields", async () => {
  const f=fixture(); const result=await recordAdLiveDate(f.client,request,"2026-10-14");
  assert.equal(result.ok,true); assert.equal(f.writes.length,1);
  assert.equal(f.writes[0].table,"assignment_post_schedule");
  assert.deepEqual(Object.keys(f.writes[0].value).sort(),["live_date","metadata","status"]);
  assert.equal(f.post.status,"posted"); assert.equal(f.post.live_date,request.liveDate);
});
test("manual live confirmation moves uninvoiced revenue from pipeline to recognized revenue and matching cost", async () => {
  const f=fixture();
  const input = { lines:[{id:"l",campaign_header_id:"c",currency_code:"EGP",revenue_before_vat:1000,cost_before_vat:600}],
    deliverables:[{id:"d",campaign_line_id:"l",quantity:1,live_date:null,revenue_before_vat:1000,cost_before_vat:600}],
    posts:[f.post],publications:[],rates:new Map([["EGP",1]]),campaignCurrencies:new Map([["c","EGP"]]),today:"2026-10-14" };
  const io:PipelineIo={id:"io",campaign_header_id:"c",document_number:"CIO-1",status:"approved",is_superseded:false,approved_at:null,assignment_snapshot:null};
  const selection=[{client_io_id:"io",campaign_line_id:"l"}];
  assert.equal(buildPipelineRevenue(input,[io],selection)[0].pipeline_revenue,1000);
  await recordAdLiveDate(f.client,request,input.today);
  assert.equal(buildPipelineRevenue(input,[io],selection).length,0);
  const events=buildRecognitionEvents(input); assert.equal(events[0].revenue,1000); assert.equal(events[0].cost,600);
});
test("invalid, impossible and future actual dates never write", async () => {
  for(const liveDate of ["","2026-02-30","2026-10-15","bad"]) {
    const f=fixture(); assert.equal((await recordAdLiveDate(f.client,{...request,liveDate},"2026-10-14")).ok,false); assert.equal(f.writes.length,0);
  }
});
test("campaign mismatch and locked date correction never write", async () => {
  for(const f of [fixture({},false),fixture({live_date:"2026-09-01"})]) {
    assert.equal((await recordAdLiveDate(f.client,request,"2026-10-14")).ok,false); assert.equal(f.writes.length,0);
  }
  const same=fixture({live_date:request.liveDate}); assert.equal((await recordAdLiveDate(same.client,request,"2026-10-14")).ok,true);
});
