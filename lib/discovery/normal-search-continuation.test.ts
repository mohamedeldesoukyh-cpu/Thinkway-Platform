import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { cloneCreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import { candidateFromProjection } from "./normal-search-transport";
import { executeNormalSearch, type Candidate, type NormalSearchRequest, type NormalSearchContinuation } from "./normal-search";
import { decodeContinuation, encodeContinuation, readContinuationSecret, runContinuedNormalSearch } from "./normal-search-continuation";

const secret = randomBytes(32).toString("base64url");
const now = Date.parse("2026-09-20T12:00:00Z");
const request = (): NormalSearchRequest => ({ filters: cloneCreatorSearchFilters(), sort: { field: "relevance", direction: "desc" }, page: 1, pageSize: 24 });
function rows(count: number, sparse = false): Candidate[] {
  return Array.from({ length: count }, (_, i) => candidateFromProjection({
    unified_id: `inf:${String(i).padStart(4,"0")}`, influencer_id: String(i), display_name: i === 3 ? "beauty" : `Beauty ${i}`,
    country_code: sparse && i % 9 !== 0 ? "AE" : "EG", categories: ["Beauty"], search_rank: 20,
    platforms: [{ id: String(i), platform: "instagram", handle: `beauty${i}`, profile_url: null, follower_count: i * 100, engagement_rate: 5, audience_country: null }],
  }));
}
for (const scenario of ["broad", "sparse", "keyword", "followers sort", "exact handle", "exhausted"] as const) {
  test(`continuation matches replay: ${scenario}, all pages, scores and reasons`, async () => {
    const cs = rows(scenario === "exhausted" ? 65 : 850, scenario === "sparse" || scenario === "keyword");
    // Duplicate across candidate windows must not reappear after continuation.
    if (cs.length > 400) cs[400] = cs[0];
    const req = request();
    req.filters.countries = ["EG"];
    if (scenario === "keyword" || scenario === "exact handle") req.filters.search = scenario === "exact handle" ? "@beauty3" : "beauty";
    if (scenario === "followers sort") req.sort = { field: "followers", direction: "desc" };
    let state: NormalSearchContinuation | undefined;
    const all: string[] = [];
    for (let page = 1; page <= 40; page++) {
      const r = { ...req, page };
      const offsets: number[] = [];
      const reader = async (offset: number, limit: number) => ({ candidates: cs.slice(offset, offset+limit), exhausted: offset+limit >= cs.length });
      const replay = await executeNormalSearch(r, reader, { now: () => now });
      const result = await executeNormalSearch(r, async (offset,limit) => { offsets.push(offset); return reader(offset,limit); }, { continuation: state, now: () => now });
      assert.deepEqual(result.creators, replay.creators);
      assert.deepEqual(result.completeness, replay.completeness);
      assert.equal(result.total, replay.total);
      assert.equal(result.has_more, replay.has_more);
      if (state) assert.ok(offsets.every(offset => offset >= state!.examined));
      all.push(...result.creators.map(c => c.unified_id));
      if (!result.has_more) break;
      assert.ok(result.continuation);
      // Exercise the actual serialized, authenticated envelope between every page.
      state = decodeContinuation(encodeContinuation(result.continuation, r, "user-a", secret, now), { ...r, page: page+1 }, "user-a", secret, now);
    }
    assert.equal(new Set(all).size, all.length);
    assert.equal(all.length, new Set(cs.filter(c => c.country_code === "EG").map(c => c.unified_id)).size);
  });
}
test("43-person pool carries 19; page two reads only 400/600; third uses carry only", async () => {
  const cs = rows(900).map((c,i) => ({ ...c, country_code: i < 400 ? i < 43 ? "EG" : "AE" : i >= 400 && i < 422 || i >= 600 && i < 620 ? "EG" : "AE" }));
  // Distribute the first pool across both windows.
  for (let i=22;i<43;i++) { cs[i].country_code="AE"; cs[200+i-22].country_code="EG"; }
  const r = request(); r.filters.countries=["EG"];
  let state: NormalSearchContinuation | undefined;
  for (let page=1;page<=3;page++) {
    const offsets: number[]=[];
    const result=await executeNormalSearch({...r,page},async(offset,limit)=>{offsets.push(offset);return {candidates:cs.slice(offset,offset+limit),exhausted:offset+limit>=cs.length};},{continuation:state,now:()=>now});
    assert.deepEqual(offsets,page===1?[0,200]:page===2?[400,600]:[]);
    assert.equal(result.creators.length,24);
    state=result.continuation;
    if(page===1) assert.equal(state?.remaining.length,19);
  }
});

const mutations: Record<string,(r:NormalSearchRequest)=>void> = {
  keyword:r=>{r.filters.search="other";}, country:r=>{r.filters.countries=["EG"];}, category:r=>{r.filters.categories=["Beauty"];},
  platform:r=>{r.filters.platforms=["instagram"];}, followers:r=>{r.filters.minFollowers="1000";}, engagement:r=>{r.filters.minEngagement="4";},
  sort:r=>{r.sort.field="followers";}, pageSize:r=>{r.pageSize=25;}, page:r=>{r.page=3;}, clear:r=>{r.filters.search="";},
};
async function tokenFixture() {
  const req=request(); req.filters.search="beauty";
  const result=await executeNormalSearch(req,async()=>({candidates:rows(200),exhausted:false}),{now:()=>now});
  return { req, token:encodeContinuation(result.continuation!,req,"user-a/context-a",secret,now) };
}
for (const [name,mutate] of Object.entries(mutations)) test(`reject incompatible ${name}`,async()=>{
  const {req,token}=await tokenFixture();req.page=2;mutate(req);
  assert.throws(()=>decodeContinuation(token,req,"user-a/context-a",secret,now),/invalid/);
});
test("reject another user/context, expiry, wrong key and tampering",async()=>{
  const {req,token}=await tokenFixture();req.page=2;
  for(const context of ["user-b/context-a","user-a/context-b"]) assert.throws(()=>decodeContinuation(token,req,context,secret,now),/invalid/);
  assert.throws(()=>decodeContinuation(token,req,"user-a/context-a",secret,now+900_000),/invalid/);
  assert.throws(()=>decodeContinuation(token,req,"user-a/context-a",secret+"changed",now),/invalid/);
  for(const bad of ["", "not.a.token",token.slice(0,-10), "x".repeat(750_001), (token[0]==="A"?"B":"A")+token.slice(1)]) assert.throws(()=>decodeContinuation(bad,req,"user-a/context-a",secret,now),/invalid/);
});
test("invalid/missing continuation never retrieves or accepts arbitrary identities",async()=>{
  const client={rpc:async(name:string)=>{if(name==="has_permission")return {data:true,error:null};throw Error("must not retrieve");}};
  for(const continuation of [undefined,"arbitrary-creator-id"]) await assert.rejects(runContinuedNormalSearch(client as never,{...request(),page:2,continuation},"user",secret),/invalid/);
  await assert.rejects(runContinuedNormalSearch(client as never,request(),"user",""),/secret/);
});
test("encrypted continuation retries are deterministic and transport is read-only",async()=>{
  const names:string[]=[];
  const client={rpc:async(name:string)=>{names.push(name);if(name==="has_permission")return {data:true,error:null};return {data:{items:rows(200),exhausted:false,scannedCount:200},error:null};}};
  const first=await runContinuedNormalSearch(client as never,request(),"user",secret);
  const r={...request(),page:2,continuation:first.continuation};
  const second=await runContinuedNormalSearch(client as never,r,"user",secret);
  const retry=await runContinuedNormalSearch(client as never,r,"user",secret);
  assert.deepEqual(second.creators,retry.creators);
  assert.deepEqual(names,["has_permission","discovery_normal_candidate_window","has_permission","has_permission"]);
  assert.ok(!first.continuation?.includes("Beauty"));
});

 test("permission revocation blocks even a carried-only page",async()=>{
  let allowed=true;
  const client={rpc:async(name:string)=>name==="has_permission"?{data:allowed,error:null}:{data:{items:rows(200),exhausted:false},error:null}};
  const first=await runContinuedNormalSearch(client as never,request(),"user",secret);
  allowed=false;
  await assert.rejects(runContinuedNormalSearch(client as never,{...request(),page:2,continuation:first.continuation},"user",secret),/Unauthorized/);
 });
 test("only the existing permission and candidate read RPCs are used",async()=>{
  const names:string[]=[];
  const client={rpc:async(name:string,args:Record<string,unknown>)=>{names.push(name);return name==="has_permission"?{data:args.p_permission==="influencers.read",error:null}:{data:{items:[],exhausted:true},error:null};}};
  await runContinuedNormalSearch(client as never,request(),"user",secret);
  assert.deepEqual(names,["has_permission","has_permission","discovery_normal_candidate_window"]);
 });

test("dedicated runtime secret is required, canonical and never returned in continuation state", async () => {
  const previous = process.env.DISCOVERY_CONTINUATION_SECRET;
  try {
    for (const invalid of [undefined, "", "development-default", "x".repeat(32), "x".repeat(44)]) {
      if (invalid === undefined) delete process.env.DISCOVERY_CONTINUATION_SECRET;
      else process.env.DISCOVERY_CONTINUATION_SECRET = invalid;
      assert.throws(readContinuationSecret, /unavailable or invalid/);
    }
    process.env.DISCOVERY_CONTINUATION_SECRET = secret;
    const runtimeSecret = readContinuationSecret();
    const calls: number[] = [];
    const client = { rpc: async (name:string, args:Record<string,unknown>) => {
      if (name === "has_permission") return {data:true,error:null};
      calls.push(Number(args.p_offset));
      return {data:{items:rows(200),scannedCount:200,exhausted:false},error:null};
    }};
    const first = await runContinuedNormalSearch(client as never,request(),"runtime-user",runtimeSecret);
    const second = await runContinuedNormalSearch(client as never,{...request(),page:2,continuation:first.continuation},"runtime-user",readContinuationSecret());
    assert.equal(second.creators.length,24);
    assert.deepEqual(calls,[0]);
    assert.ok(!JSON.stringify([first,second]).includes(runtimeSecret));
    const state = decodeContinuation(first.continuation!,{...request(),page:2},"runtime-user",runtimeSecret);
    assert.ok(!JSON.stringify(state).includes(runtimeSecret));
    const action = readFileSync("features/discovery/normal-search-action.ts","utf8");
    assert.ok(action.startsWith('"use server";'));
    assert.match(action,/readContinuationSecret\(\)/);
    assert.doesNotMatch(action,/SUPABASE_SERVICE_ROLE_KEY|APIFY_TOKEN|RESEND|NEXT_PUBLIC_DISCOVERY_CONTINUATION/);
    const clientSource = readFileSync("features/discovery/components/creator-search/creator-search-workspace.tsx","utf8");
    assert.doesNotMatch(clientSource,/DISCOVERY_CONTINUATION_SECRET|readContinuationSecret/);
  } finally {
    if (previous === undefined) delete process.env.DISCOVERY_CONTINUATION_SECRET;
    else process.env.DISCOVERY_CONTINUATION_SECRET = previous;
  }
});
