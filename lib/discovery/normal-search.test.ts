import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { cloneCreatorSearchFilters, type CreatorSearchFilters, type CreatorSearchSortState } from "@/features/discovery/components/creator-search/creator-search-types";
import { candidateFromProjection, runNormalSearchTransport } from "./normal-search-transport";
import { cleanDiscoveryCategories, evaluateNormalCandidate, executeNormalSearch, hasNormalSearchContext, normalRetrievalQuery, sanitizeNormalFilters, type Candidate } from "./normal-search";
import { normalizeDiscoverySearchText } from "./discovery-search-normalize";
import { creatorMatchesDiscoveryBrowseFilters } from "@/lib/creators/discovery-browse-filters";
import type { SupabaseClient } from "@supabase/supabase-js";

const filters = (patch: Partial<CreatorSearchFilters> = {}) => ({ ...cloneCreatorSearchFilters(), ...patch });
function creator(id = "a", patch: Partial<Candidate> = {}): Candidate {
  return candidateFromProjection({ unified_id: `inf:${id}`, influencer_id: id, display_name: "Amina Beauty", country_code: "EG", categories: ["Beauty","Lifestyle"], bio: "Beauty makeup tips Cairo جمال مكياج", language_codes: ["ar","en"], ai_niche: "Beauty tutorials", stored_thinkway_score: 75, last_post_at: "2026-09-18T00:00:00Z", search_rank: 200,
    platforms: [{ id, platform: "instagram", handle: "amina", profile_url: "https://instagram.com/amina", follower_count: 600000, engagement_rate: 5, avg_views: 90000, audience_country: "EG" }], ...patch });
}
const now = Date.parse("2026-09-20T00:00:00Z");
const evaluate = (f: Partial<CreatorSearchFilters>, c = creator()) => evaluateNormalCandidate(c,filters(f),now);
async function search(cs: Candidate[], patch: Partial<CreatorSearchFilters> = {}, sort: CreatorSearchSortState = { field:"relevance",direction:"desc" }, page=1, pageSize=10, maxCandidates=10000) {
  return executeNormalSearch({ filters:filters(patch),sort,page,pageSize },async(offset,limit)=>({ candidates:cs.slice(offset,offset+limit),exhausted:offset+limit>=cs.length }),{now:()=>now,maxCandidates});
}

for (const [name,patch] of Object.entries({
  "country only":{countries:["EG"]}, "category only":{categories:["Beauty"]}, "platform only":{platforms:["instagram"]},
  "follower band":{followerRanges:[{min:"500000",max:"999999"}]}, "engagement":{minEngagement:"4"}, "views":{minViews:"80000"},
  "language":{languages:["ar"]}, "niche":{aiNiche:"Beauty"}, "recent activity":{lastPostWithin:"7d"}, "Thinkway stored score":{minThinkwayScore:"70"},
  "OR country":{countries:["AE","EG"]}, "OR category":{categories:["Sports","Beauty"]}, "OR platform":{platforms:["youtube","instagram"]},
  "OR follower bands":{followerRanges:[{min:"1000",max:"9000"},{min:"500000",max:"999999"}]},
  "country category":{countries:["EG"],categories:["Beauty"]},
  "country category followers":{countries:["EG"],categories:["Beauty"],minFollowers:"500000"},
  "query country category":{search:"beauty",countries:["EG"],categories:["Beauty"]},
  "query five filters":{search:"beauty",countries:["EG"],categories:["Beauty"],platforms:["instagram"],minFollowers:"500000",minEngagement:"4"},
})) test(name,()=>assert.equal(evaluate(patch).eligible,true));

test("hard failure cannot be rescued by exact text",()=>{const r=evaluate({search:"@amina",countries:["AE"]});assert.equal(r.eligible,false);assert.equal(r.relevance.score,null)});
test("missing metrics do not qualify a hard requirement",()=>{const c=creator();c.platforms[0].avg_views=null;const r=evaluate({minViews:"1"},c);assert.equal(r.eligible,false);assert.equal(r.relevance.reasons[0].outcome,"Not available")});
test("same account must satisfy platform and all metrics",()=>{const c=creator();c.platforms.push({...c.platforms[0],id:"tt",platform:"tiktok",follower_count:500,engagement_rate:30});assert.equal(evaluate({platforms:["tiktok"],minFollowers:"500000",minEngagement:"4"},c).eligible,false)});
test("secondary account handle works",()=>{const c=creator();c.platforms.push({...c.platforms[0],handle:"second"});assert.equal(evaluate({handle:"second"},c).eligible,true)});
test("creator country inference remains",()=>{const r=evaluate({countries:["EG"]},creator("a",{country_code:null,platforms:[],bio:"Cairo Egypt"}));assert.equal(r.eligible,true)});
test("audience geography never uses creator or account location",()=>{const c=creator();assert.equal(creatorMatchesDiscoveryBrowseFilters(c,{audienceCountries:["EG"]}),false)});
const demographics = { source:"manual" as const, topCountries:[{code:"AE",percent:80}], topCities:null,gender:{male:20,female:80,unknown:null},age:{"13_17":null,"18_24":15,"25_34":85,"35_44":null,"45_54":null,"55_plus":null} };
test("future genuine audience OR geography contract remains",()=>assert.equal(creatorMatchesDiscoveryBrowseFilters(creator("a",{audience_demographics:demographics}),{audienceCountries:["SA","AE"]}),true));
test("audience gender uses audience share",()=>assert.equal(evaluate({gender:"female"},creator("a",{audience_demographics:demographics})).eligible,true));
test("audience age range uses observed dominant band overlap",()=>assert.equal(evaluate({ageMin:"18",ageMax:"34"},creator("a",{audience_demographics:demographics})).eligible,true));
test("unavailable demographics never qualify",()=>assert.equal(evaluate({gender:"female"},creator("a",{audience_demographics:{...demographics,source:"unavailable"}})).eligible,false));
test("audience interests never use category/niche/import proxy",()=>assert.equal(creatorMatchesDiscoveryBrowseFilters(creator("a",{audience_interests:["Beauty"]}),{audienceInterestTags:["Beauty"]}),false));
test("unsupported controls cleared, not silently evaluated",()=>{const f=sanitizeNormalFilters(filters({audienceInterestTags:["Beauty"],contentLanguages:["ar"],minBrandSafety:"80",minAiScore:"90",minBrandFit:"20"}));assert.equal(hasNormalSearchContext(f),false)});
test("null irrelevant evidence does not lower text relevance",()=>assert.equal(evaluate({search:"@amina"},creator("a",{audience_demographics:undefined})).relevance.score,100));
test("binary context does not manufacture 100 percent",()=>{const r=evaluate({countries:["EG"],minFollowers:"500000"});assert.equal(r.eligible,true);assert.equal(r.relevance.score,null)});
test("Relevance changes with request",()=>assert.notEqual(evaluate({search:"@amina"}).relevance.score,evaluate({search:"beauty tips"}).relevance.score));
test("no context means no Relevance field",async()=>assert.equal((await search([creator()])).creators[0].discovery_relevance,undefined));
test("exact name",()=>assert.equal(evaluate({search:"Amina Beauty"}).relevance.score,100));
test("partial handle",()=>assert.equal(evaluate({search:"amin"}).relevance.score,90));
test("English keyword",()=>assert.equal(evaluate({search:"makeup"}).relevance.score,80));
test("Arabic keyword",()=>assert.equal(evaluate({search:"مَكْيَاج"}).relevance.score,80));
test("Arabic normalization symmetrical",()=>assert.equal(normalizeDiscoverySearchText("إِبْداع"),normalizeDiscoverySearchText("ابداع")));
for(const url of ["https://www.instagram.com/amina/","https://www.tiktok.com/@amina"]) test(`profile URL ${url}`,()=>assert.equal(normalRetrievalQuery(filters({search:url})),"@amina"));
test("taxonomy removes country not categories",()=>assert.deepEqual(cleanDiscoveryCategories(["egypt","EG","Beauty","Fitness"]),["Beauty","Fitness"]));
test("clear reset removes relevance and constraints",()=>assert.equal(hasNormalSearchContext(filters()),false));
test("first page does not wait for a higher-scoring candidate in a later pool",async()=>{const cs=Array.from({length:260},(_,i)=>creator(String(i),{display_name:`Other ${i}`}));cs[250]=creator("best",{display_name:"Target"});const result=await search(cs,{search:"Target"});assert.equal(result.completeness.examined,200);assert.equal(result.completeness.status,"bounded");assert.ok(!result.creators.some(c=>c.unified_id==="inf:best"));});
for(const field of ["followers","engagement","relevance"] as const) test(`pool ${field} deterministic pagination`,async()=>{
  const cs=Array.from({length:230},(_,i)=>{const c=creator(String(i).padStart(3,"0"),{display_name:`Amina ${i}`});c.platforms[0].follower_count=i;c.platforms[0].engagement_rate=i;return c});
  const sort={field,direction:"desc" as const};const p2=await search(cs,{search:"amina"},sort,2,20);const p1=await search(cs,{search:"amina"},sort,1,20);const all=await search(cs,{search:"amina"},sort,1,40);
  assert.deepEqual([...p1.creators,...p2.creators].map(c=>c.unified_id),all.creators.map(c=>c.unified_id));assert.equal(new Set([...p1.creators,...p2.creators].map(c=>c.unified_id)).size,40);
});
test("budget stop before a qualified pool is incomplete and honest",async()=>{const cs=Array.from({length:250},(_,i)=>creator(String(i),{country_code:"EG"}));const r=await search(cs,{countries:["AE"]},undefined,1,10,200);assert.equal(r.has_more,true);assert.equal(r.completeness.status,"incomplete");assert.equal(r.completeness.totalKind,"lower_bound");assert.deepEqual(r.creators,[])});
test("sparse windows do not hide a later match",async()=>{const cs=Array.from({length:650},(_,i)=>creator(String(i),{country_code:i===649?"AE":"EG"}));assert.equal((await search(cs,{countries:["AE"]})).total,1)});
test("normal transport exposes no mutation capability",async()=>{const calls:string[]=[];const client={rpc:async(name:string)=>{calls.push(name);return {data:{items:[creator()],exhausted:true},error:null}}} as unknown as Pick<SupabaseClient,"rpc">;await runNormalSearchTransport(client,{filters:filters(),sort:{field:"name",direction:"asc"},page:1,pageSize:24});assert.deepEqual(calls,["discovery_normal_candidate_window"])});
test("migration absence fails closed without old write path",async()=>{const client={rpc:async()=>({error:{code:"PGRST202",message:"missing"}})} as unknown as Pick<SupabaseClient,"rpc">;await assert.rejects(runNormalSearchTransport(client,{filters:filters(),sort:{field:"name",direction:"asc"},page:1,pageSize:24}),/migration/)});
test("normal UI preserves authoritative order",()=>{const source=readFileSync("features/discovery/components/creator-search/creator-search-workspace.tsx","utf8");assert.match(source,/aiModeActive \? sortCreators\(creators, sort\) : creators/);assert.match(source,/requestId !== reqIdRef.current/);assert.match(source,/completeness\?\.status === "incomplete"/)});

// Cursor progress counts raw identity candidates, even when canonical dedupe drops a projection.
test("empty deduplicated window continues with raw cursor", async () => {
  const offsets: number[] = [];
  const r = await executeNormalSearch({ filters: filters(), sort: { field: "name", direction: "asc" }, page: 1, pageSize: 10 }, async offset => {
    offsets.push(offset);
    return offset === 0 ? { candidates: [], scannedCount: 200, exhausted: false } : { candidates: [creator()], scannedCount: 1, exhausted: true };
  });
  assert.deepEqual(offsets,[0,200]); assert.equal(r.total,1); assert.equal(r.internal_count,1);
});
test("content keyword AND tag dimension; OR within tags", () => {
  assert.equal(evaluate({ contentKeyword: "makeup tips", contentTags: ["fitness", "makeup"] }).eligible, true);
  assert.equal(evaluate({ contentKeyword: "missing", contentTags: ["makeup"] }).eligible, false);
  assert.equal(evaluate({ contentTags: ["missing"] }).eligible, false);
});
test("content constraints do not narrow lexical query with AND across OR tags", () => {
  assert.equal(normalRetrievalQuery(filters({ search: "amina", contentTags: ["beauty", "fitness"] })), "amina");
});
test("name filter uses actual name or any handle",()=>assert.equal(evaluate({handle:"Amina Beauty"}).eligible,true));
test("old country-category URL values sanitized",()=>assert.deepEqual(sanitizeNormalFilters(filters({categories:["EG","Beauty"]})).categories,["Beauty"]));
test("normal unmount does not send acquisition cancellation",()=> {
  const source=readFileSync("features/discovery/components/creator-search/creator-search-workspace.tsx","utf8");
  assert.match(source,/if \(acquisitionPollJobRef.current.length\) session.dispose\(\)/);
});

test("existing public-profile readiness gate remains",()=>{
  assert.equal(evaluate({},creator("draft",{influencer_id:null,source_type:"public_discovery",status:"draft"})).eligible,false);
  assert.equal(evaluate({},creator("ready",{influencer_id:null,source_type:"public_discovery",status:"basic_enriched"})).eligible,true);
});

test("profile URL in name/handle filter reconciles with stored handle",()=>assert.equal(evaluate({handle:"https://instagram.com/amina/"}).eligible,true));

for (const direction of ["asc","desc"] as const) test("unknown follower values sort last " + direction, async()=>{
  const known=creator("known"); const unknown=creator("unknown"); unknown.platforms[0].follower_count=null;
  assert.equal((await search([unknown,known],{}, {field:"followers",direction})).creators[1].unified_id,"inf:unknown");
});

const closureScenarios: Array<[string, Partial<CreatorSearchFilters>, boolean]> = [
  ["A country", {countries:["EG"]}, false],
  ["B platform", {platforms:["instagram"]}, false],
  ["C follower band", {minFollowers:"500000",maxFollowers:"1000000"}, false],
  ["D engagement minimum", {minEngagement:"4"}, true],
  ["E country followers", {countries:["EG"],minFollowers:"500000"}, false],
  ["F country category followers", {countries:["EG"],categories:["Beauty"],minFollowers:"500000"}, false],
  ["G platform followers engagement", {platforms:["instagram"],minFollowers:"500000",minEngagement:"4"}, true],
  ["H keyword filters", {search:"amina",countries:["EG"],minEngagement:"4"}, true],
  ["I category filters", {categories:["Beauty"],countries:["EG"]}, false],
  ["I niche filters", {aiNiche:"Beauty",countries:["EG"]}, true],
];
for (const [name,request,graded] of closureScenarios) test("closure scenario " + name,()=> {
  const a=creator();a.platforms[0].engagement_rate=4;
  const b=creator("b");b.platforms[0].engagement_rate=8;b.platforms[0].follower_count=900000;
  const x=evaluate(request,a),y=evaluate(request,b);
  assert.equal(x.eligible,true);assert.equal(y.eligible,true);
  assert.equal(hasNormalSearchContext(filters(request)),true);
  assert.equal(x.relevance.score!==null,graded);
  if(request.minEngagement) assert.ok(y.relevance.score!>x.relevance.score!);
  else assert.equal(x.relevance.score,y.relevance.score,"binary or identical text evidence adds no fabricated differentiation");
});
test("requested numeric headroom uses only qualified account and saturates",()=>{
  const a=creator();a.platforms[0].engagement_rate=4;a.platforms[0].avg_views=10000;
  assert.equal(evaluate({minEngagement:"4"},a).relevance.score,50);
  a.platforms[0].engagement_rate=8;assert.equal(evaluate({minEngagement:"4"},a).relevance.score,75);
  assert.equal(evaluate({minViews:"10000"},a).relevance.score,50);
  a.platforms[0].avg_views=20000;assert.equal(evaluate({minViews:"10000"},a).relevance.score,75);
  assert.equal(evaluate({minEngagement:"9"},a).eligible,false);
  assert.equal(evaluate({minEngagement:"9"},a).relevance.score,null);
  assert.equal(evaluate({minEngagement:"0"},a).relevance.score,null);
  a.platforms[0].engagement_rate=null;assert.equal(evaluate({minEngagement:"4"},a).eligible,false);
});
test("numeric headroom is contextual, not an unrequested quality bonus",()=>{
  const a=creator();a.platforms[0].engagement_rate=99;
  assert.equal(evaluate({search:"@amina"},a).relevance.score,100);
  assert.equal(evaluate({search:"@amina",minEngagement:"4"},a).relevance.score,99);
});
test("requested content phrase differentiates contiguous versus dispersed evidence",()=>{
  assert.equal(evaluate({contentKeyword:"makeup tips"}).relevance.score,100);
  assert.equal(evaluate({contentKeyword:"makeup tips"},creator("b",{bio:"makeup and useful tips"})).relevance.score,80);
});

test("bounded page returns from one window with an honest count",async()=>{
  const cs=Array.from({length:900},(_,i)=>creator(String(i).padStart(4,'0')));
  const r=await search(cs,{countries:['EG']},undefined,1,24);
  assert.equal(r.creators.length,24);assert.equal(r.completeness.examined,200);
  assert.equal(r.total,200);assert.equal(r.has_more,true);assert.equal(r.completeness.status,'bounded');
  assert.equal(r.completeness.totalKind,'lower_bound');assert.ok(r.creators.every(c=>c.discovery_relevance?.score===null));
});

test("all pages cross fixed pool boundaries without loss, duplication or reshuffling",async()=>{
  const cs=Array.from({length:465},(_,i)=>{const c=creator(String(i).padStart(4,'0'));c.platforms[0].engagement_rate=i+4;return c});
  // Simulate repeated IDs across retrieval windows; raw offsets must still advance.
  cs.splice(210,0,cs[4]);
  const ids:string[]=[];
  for(let page=1;page<=20;page++){
    const r=await search(cs,{minEngagement:'4'},undefined,page,24);
    const repeat=await search(cs,{minEngagement:'4'},undefined,page,24);
    assert.deepEqual(r.creators,repeat.creators);
    ids.push(...r.creators.map(c=>c.unified_id));
    if(page===20){assert.equal(r.has_more,false);assert.equal(r.total,465);assert.equal(r.completeness.totalKind,'exact');}
  }
  assert.equal(ids.length,465);assert.equal(new Set(ids).size,465);
  assert.deepEqual([...ids].sort(),[...new Set(cs.map(c=>c.unified_id))].sort());
});

test("sparse windows close a pool only at a deterministic full-window boundary",async()=>{
  const cs=Array.from({length:850},(_,i)=>creator(String(i).padStart(4,'0'),{country_code:i%10===0?'AE':'EG'}));
  const a=await search(cs,{countries:['AE']},undefined,1,24);
  const b=await search(cs,{countries:['AE']},undefined,2,24);
  assert.equal(a.completeness.examined,400);assert.equal(a.creators.length,24);
  assert.equal(b.completeness.examined,800);assert.equal(b.creators.length,24);
  assert.equal(new Set([...a.creators,...b.creators].map(c=>c.unified_id)).size,48);
});

test("exact identity precedes a higher combined relevance score within the retrieved pool",async()=>{
  const exact=creator('exact');exact.platforms[0].engagement_rate=4;
  const other=creator('other',{display_name:'Amina extended'});other.platforms[0].handle='aminax';other.platforms[0].engagement_rate=100;
  const r=await search([other,exact],{search:'@amina',minEngagement:'4'},undefined,1,24);
  assert.equal(r.creators[0].unified_id,'inf:exact');
  assert.ok(r.creators[0].discovery_relevance!.score!<r.creators[1].discovery_relevance!.score!);
});


test("unsupported audience country from saved filters cannot activate search or relevance", async () => {
  const stale = filters({ audienceCountries: ["EG"] });
  assert.deepEqual(sanitizeNormalFilters(stale).audienceCountries, []);
  assert.deepEqual(stale.audienceCountries, ["EG"]);
  assert.equal(hasNormalSearchContext(stale), false);
  assert.deepEqual(await search([creator()], { audienceCountries: ["EG"] }), await search([creator()]));
});

test("unsupported audience country does not change supported filter results or relevance", async () => {
  const supported = { countries: ["EG"], categories: ["Beauty"], minEngagement: "3", search: "beauty" };
  const candidates = [creator(), creator("other", { country_code: "AE", bio: "Dubai" })];
  assert.deepEqual(await search(candidates, { ...supported, audienceCountries: ["AE"] }), await search(candidates, supported));
  assert.deepEqual(sanitizeNormalFilters(filters()).audienceCountries, []);
});
