import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createEmptyCampaignIntelligenceProfile } from "@/features/campaign-intelligence-profile/types/profile";
import { createEmptyValidatedIntelligence } from "@/features/campaign-intelligence-profile/types/validated-intelligence";
import { discoveryRequirementsToProfile, profileToDiscoveryRequirements } from "@/features/campaign-intelligence-profile/services/discovery-campaign-requirements";
import { mapCampaignIntelligenceToDiscoverySearch } from "@/features/campaign-intelligence-profile/services/discovery-search-mapping";
import { cloneCreatorSearchFilters } from "@/features/discovery/components/creator-search/creator-search-types";
import { applyBriefSelections, briefRanking, markManualChanges } from "./brief-search";
import { candidateFromProjection } from "./normal-search-transport";
import { executeNormalSearch, evaluateNormalCandidate, type NormalSearchRequest } from "./normal-search";
import { runContinuedNormalSearch, encodeContinuation, decodeContinuation } from "./normal-search-continuation";

test("confirmed category evidence overrides stale legacy inferred source", () => {
  const p = { ...profile(), creatorCategories: ["Beauty"], sources: { creatorCategories: "inferred" as const }, fieldProvenance: { creatorCategories: { level: "extracted" as const, confidence: 1, sourceField: "operator", excerpt: "Beauty creators" } } };
  assert.deepEqual(applyBriefSelections(p, cloneCreatorSearchFilters(), {}).filters.categories, ["Beauty"]);
});

test("Beauty eligibility uses canonical categories and excludes unrelated-only creators", () => {
  const f = request().filters;
  for (const categories of [["Food"], ["Travel"], ["Lifestyle"]]) assert.equal(evaluateNormalCandidate({ ...candidate(), categories, bio: "Travel and food" }, f).eligible, false);
  for (const categories of [["Beauty"], ["Beauty & Cosmetics"], ["Beauty", "Food"]]) assert.equal(evaluateNormalCandidate({ ...candidate(), categories }, f).eligible, true);
});

test("brief beauty refinement returns a sparse budget pool and continues without replay or gaps", async () => {
  const req = request(); req.filters.search = "beauty";
  const ranking = briefRanking(profile());
  const rows = Array.from({ length: 1000 }, (_, i) => ({ ...candidate(String(i).padStart(4, "0")), categories: i < 800 && i % 40 !== 0 ? ["Food"] : ["Beauty"], bio: i < 800 && i % 40 !== 0 ? "Food" : "Beauty skincare" }));
  let time = 1000;
  const offsets: number[] = [];
  const reader = async (offset: number, limit: number) => { offsets.push(offset); time += 1600; return { candidates: rows.slice(offset, offset + limit), exhausted: offset + limit >= rows.length }; };
  const first = await executeNormalSearch(req, reader, { evaluate: ranking.evaluate, now: () => time });
  assert.equal(first.creators.length, 20);
  assert.equal(first.completeness.status, "incomplete");
  assert.equal(first.completeness.reason, "time_budget");
  assert.equal(first.completeness.examined, 800);
  assert.deepEqual(offsets, [0, 200, 400, 600]);
  assert.ok(first.continuation);
  const secret = randomBytes(32).toString("base64url");
  const secondReq = { ...req, page: 2 };
  const token = encodeContinuation(first.continuation, req, ranking.binding, secret);
  const state = decodeContinuation(token, secondReq, ranking.binding, secret);
  offsets.length = 0;
  const second = await executeNormalSearch(secondReq, reader, { evaluate: ranking.evaluate, now: () => time, continuation: state });
  assert.deepEqual(offsets, [800]);
  assert.equal(second.creators.length, 24);
  const ids = [...first.creators, ...second.creators].map(c => c.unified_id);
  assert.equal(new Set(ids).size, 44);
  const repeated = await executeNormalSearch(secondReq, reader, { evaluate: ranking.evaluate, now: () => time, continuation: state });
  assert.deepEqual(repeated.creators, second.creators);
  assert.equal(second.creators[0].unified_id, "inf:0800");
});

function profile() {
  const v = createEmptyValidatedIntelligence();
  v.creator = { ...v.creator, countries: ["EG"], languages: ["ar"], tiers: ["macro"], niches: ["skincare"] };
  v.platforms = ["instagram"]; v.categories = ["Beauty"];
  v.audience.countries = ["SA"]; v.market.countryCode = "AE";
  return { ...createEmptyCampaignIntelligenceProfile(), validatedIntelligence: v, budget: { amount: 500000, currency: "EGP" }, marketTier: "premium" as const };
}
const candidate = (id = "1") => candidateFromProjection({ unified_id: `inf:${id}`, influencer_id: id, display_name: `Creator ${id}`, country_code: "EG", categories: ["Beauty"], language_codes: ["ar"], bio: "skincare tips", platforms: [{ id, platform: "instagram", handle: id, profile_url: null, follower_count: 700000, engagement_rate: 5, audience_country: null }] });
const request = (): NormalSearchRequest => ({ filters: applyBriefSelections(profile(), cloneCreatorSearchFilters(), {}).filters, sort: { field: "relevance", direction: "desc" }, page: 1, pageSize: 24 });

test("all supported selections apply; audience, market and premium never become creator filters", () => {
  const result = applyBriefSelections(profile(), cloneCreatorSearchFilters(), {});
  assert.deepEqual(result.filters.countries, ["EG"]);
  assert.deepEqual(result.filters.languages, ["ar"]);
  assert.deepEqual(result.filters.platforms, ["instagram"]);
  assert.deepEqual(result.filters.categories, ["Beauty"]);
  assert.deepEqual(result.filters.followerRanges, [{ min: "500000", max: "999999" }]);
  assert.deepEqual(result.filters.audienceCountries, []);
  assert.deepEqual(result.filters.audienceInterestTags, []);
  assert.equal(result.filters.aiNiche, "");
  assert.equal(result.filters.minBrandFit, "");
  assert.ok(result.requirements.some(r => r.classification === "SOFT" && r.value === "skincare"));
  assert.ok(result.requirements.some(r => r.classification === "CONTEXT" && r.key === "budget"));
  assert.ok(result.requirements.some(r => r.classification === "UNSUPPORTED" && r.value === "SA"));
});

for (const key of ["countries", "platforms", "categories", "languages"] as const) test(`manual ${key} removal survives AI rerun`, () => {
  const ai = applyBriefSelections(profile(), cloneCreatorSearchFilters(), {});
  const manual = { ...ai.filters, [key]: [] };
  const owners = markManualChanges(ai.filters, manual, ai.owners);
  assert.deepEqual(applyBriefSelections(profile(), manual, owners).filters[key], []);
});
test("manual follower refinement owns the entire linked follower group", () => {
  const ai = applyBriefSelections(profile(), cloneCreatorSearchFilters(), {});
  const manual = { ...ai.filters, followerRanges: [], minFollowers: "1000000", maxFollowers: "" };
  const next = applyBriefSelections(profile(), manual, markManualChanges(ai.filters, manual, ai.owners));
  assert.deepEqual(next.filters.followerRanges, []); assert.equal(next.filters.minFollowers, "1000000");
});
test("structured editing retains independent creator, content and audience requirements", () => {
  const p = profile(); const requirements = profileToDiscoveryRequirements(p);
  requirements.creatorCountries = ["AE"]; requirements.contentLanguages = ["en"]; requirements.creatorLanguages = ["ar"];
  const edited = discoveryRequirementsToProfile(p, requirements);
  assert.deepEqual(edited.validatedIntelligence?.creator.countries, ["AE"]);
  assert.deepEqual(edited.validatedIntelligence?.audience.countries, ["SA"]);
  assert.deepEqual(edited.validatedIntelligence?.creator.contentLanguages, ["en"]);
  assert.equal(edited.budget?.amount, 500000);
});
test("hard country failure cannot be rescued by strong soft evidence", () => {
  const result = briefRanking(profile()).evaluate({ ...candidate(), country_code: "US" }, request().filters, Date.now());
  assert.equal(result.eligible, false); assert.equal(result.relevance.score, null);
});
test("missing soft evidence does not disqualify or manufacture a score", () => {
  const result = briefRanking(profile()).evaluate({ ...candidate(), bio: null }, request().filters, Date.now());
  assert.equal(result.eligible, true); assert.equal(result.relevance.score, null);
});
test("Match changes with brief topics and manual engagement refinement", () => {
  const p = profile(); const c = candidate(); const f = request().filters;
  const first = briefRanking(p).evaluate(c, f, Date.now());
  p.validatedIntelligence.creator.niches = ["astronomy"];
  assert.notEqual(first.relevance.score, briefRanking(p).evaluate(c, f, Date.now()).relevance.score);
  assert.notEqual(first.relevance.score, briefRanking(profile()).evaluate(c, { ...f, minEngagement: "4" }, Date.now()).relevance.score);
});
test("Thinkway score and unsupported image preferences cannot affect Match", () => {
  const p = profile(), f = request().filters, rank = briefRanking(p);
  const first = rank.evaluate(candidate(), f, Date.now()).relevance.score;
  assert.equal(rank.evaluate({ ...candidate(), thinkway_score: 100, stored_thinkway_score: 100 }, f, Date.now()).relevance.score, first);
  assert.equal(briefRanking({ ...p, marketTier: "luxury" }).evaluate(candidate(), f, Date.now()).relevance.score, first);
});
test("reasons contain actual hard matches and explicit unsupported disclosures", () => {
  const result = briefRanking(profile()).evaluate(candidate(), request().filters, Date.now());
  assert.ok(result.relevance.reasons.some(r => r.dimension === "Creator country" && r.outcome === "Match"));
  assert.ok(result.relevance.reasons.some(r => r.dimension === "Audience geography" && r.detail?.includes("not evaluated")));
});
test("soft removal disables ranking and changes token context", () => {
  const p = profile(); const soft = mapCampaignIntelligenceToDiscoverySearch(p).requirements!.filter(r => r.classification === "SOFT").map(r => r.id);
  assert.equal(briefRanking(p, soft).evaluate(candidate(), request().filters, Date.now()).relevance.score, null);
  assert.notEqual(briefRanking(p).binding, briefRanking(p, soft).binding);
});
test("normal search is unchanged without a brief evaluator", async () => {
  const req = { ...request(), filters: cloneCreatorSearchFilters() };
  const result = await executeNormalSearch(req, async () => ({ candidates: [candidate()], exhausted: true }));
  assert.equal(result.creators[0].discovery_relevance, undefined);
  assert.equal(evaluateNormalCandidate(candidate(), request().filters).relevance.score, null);
});
test("brief Match sorts within the same bounded pool and pages without replay or writes", async () => {
  const windows: number[] = [], calls: string[] = [];
  const rows = Array.from({ length: 240 }, (_, i) => ({ ...candidate(String(i).padStart(4,"0")), bio: i % 2 ? "skincare" : null }));
  const client = { rpc: async (name: string, args?: Record<string, unknown>) => {
    calls.push(name);
    if (name === "has_permission") return { data: true, error: null };
    assert.equal(name, "discovery_normal_candidate_window");
    const offset = Number(args!.p_offset); windows.push(offset);
    return { data: { items: rows.slice(offset, offset + 200), exhausted: offset + 200 >= rows.length }, error: null };
  } } as unknown as Parameters<typeof runContinuedNormalSearch>[0];
  const key = randomBytes(32).toString("base64url"), rank = briefRanking(profile()), req = request();
  const first = await runContinuedNormalSearch(client, req, rank.binding, key, rank);
  assert.equal(first.creators.length, 24);
  assert.ok(first.creators.every(c => c.discovery_relevance?.score != null));
  const secondReq = { ...req, page: 2, continuation: first.continuation };
  const second = await runContinuedNormalSearch(client, secondReq, rank.binding, key, rank);
  assert.deepEqual(first.creators.map(c=>c.discovery_relevance!.score), [...first.creators.map(c=>c.discovery_relevance!.score)].sort((a,b)=>(b??-1)-(a??-1)));
  assert.deepEqual(windows, [0]);
  assert.equal(new Set([...first.creators, ...second.creators].map(c => c.unified_id)).size, 48);
  assert.ok(calls.every(c => c === "has_permission" || c === "discovery_normal_candidate_window"));
  const changed = profile(); changed.validatedIntelligence.creator.niches = ["travel"];
  for (const binding of [briefRanking(changed).binding, briefRanking(profile(), ["creator.niches:skincare"]).binding, "normal-user-without-brief"]) {
    await assert.rejects(() => runContinuedNormalSearch(client, secondReq, binding, key, rank), /invalid|expired/);
  }
  await assert.rejects(() => runContinuedNormalSearch(client, {...secondReq,filters:{...req.filters,search:"skincare"}},rank.binding,key,rank), /invalid|expired/);
  await assert.rejects(() => runContinuedNormalSearch(client, {...secondReq,sort:{field:"engagement",direction:"desc"}},rank.binding,key,rank), /invalid|expired/);
  await assert.rejects(() => runContinuedNormalSearch(client, secondReq, "changed brief", key, rank), /invalid|expired/);
  await assert.rejects(() => runContinuedNormalSearch(client, { ...secondReq, filters: { ...req.filters, minEngagement: "4" } }, rank.binding, key, rank), /invalid|expired/);
});
test("brief UI uses existing extraction and never auto-runs on upload", () => {
  const source = readFileSync("features/discovery/components/creator-search/creator-search-brief-panel.tsx", "utf8");
  assert.match(source, /uploadCampaignBriefAction\(form\)/);
  const upload = source.slice(source.indexOf("async function upload"), source.indexOf("async function save"));
  assert.doesNotMatch(upload, /onRun\(/);
  assert.match(source, /sm:max-w-2xl/); assert.match(source, /overflow-y-auto/);
  assert.match(source, /Remove brief/); assert.doesNotMatch(source, /deleteCampaignBriefAction|Apify|enrichment/);
});


test("tier alternatives intersect explicit follower constraints and contradictions fail safely", () => {
  const p = profile(); p.validatedIntelligence.creator.followerMin = 750000;
  assert.deepEqual(applyBriefSelections(p, cloneCreatorSearchFilters(), {}).filters.followerRanges, [{ min: "750000", max: "999999" }]);
  p.validatedIntelligence.creator.followerMin = 2000000;
  assert.throws(() => applyBriefSelections(p, cloneCreatorSearchFilters(), {}), /do not overlap/);
});
test("editing unrelated fields preserves audience language and existing provenance", () => {
  const p = profile(); p.validatedIntelligence.audience.languages = ["en"];
  const evidence = { level: "extracted" as const, confidence: 1, excerpt: "Egyptian creators", sourceField: "brief" };
  p.validatedIntelligence.fieldEvidence["creator.countries"] = evidence;
  const req = profileToDiscoveryRequirements(p); req.brandName = "Edited brand";
  const edited = discoveryRequirementsToProfile(p, req);
  assert.deepEqual(edited.validatedIntelligence?.audience.languages, ["en"]);
  assert.deepEqual(edited.validatedIntelligence?.creator.countries, ["EG"]);
  assert.deepEqual(edited.validatedIntelligence?.fieldEvidence["creator.countries"], evidence);
});


test("duplicate niche/topic evidence produces one preference and one score contribution", () => {
  const p = profile(); p.validatedIntelligence.keywords = ["skincare"];
  p.validatedIntelligence.fieldEvidence.keywords = {level:"extracted",confidence:1,excerpt:"skincare"};
  const before = briefRanking(profile()).evaluate(candidate(), {...request().filters,minEngagement:"4"});
  assert.equal(mapCampaignIntelligenceToDiscoverySearch(p).requirements?.filter(r=>r.classification === "SOFT").length,1);
  assert.equal(briefRanking(p).evaluate(candidate(), {...request().filters,minEngagement:"4"}).relevance.score,before.relevance.score);
});
test("soft-only brief keeps Match sorting in the workspace", () => {
  const source = readFileSync("features/discovery/components/creator-search/creator-search-workspace.tsx", "utf8");
  assert.match(source,/if \(!briefEnabled && !showCampaignRelevance && !hasNormalSearchContext/);
});
test("multiple manual overrides remain authoritative through AI reruns and URL round trip", async () => {
  const {applyCreatorSearchFiltersToUrlParams,creatorSearchFiltersFromUrlParams}=await import("@/lib/creators/creator-search-url-params");
  const ai=applyBriefSelections(profile(),cloneCreatorSearchFilters(),{});
  const manual={...ai.filters,followerRanges:[{min:"1000000",max:"4999999"}],minEngagement:"5"};
  const owners=markManualChanges(ai.filters,manual,ai.owners),params=new URLSearchParams();
  applyCreatorSearchFiltersToUrlParams(params,manual);
  const restored=creatorSearchFiltersFromUrlParams(params);
  const again=applyBriefSelections(profile(),restored,owners);
  const { resolveCreatorSearchFollowerRanges } = await import("@/lib/creators/follower-range-filter");
  assert.deepEqual(resolveCreatorSearchFollowerRanges(again.filters),manual.followerRanges);assert.equal(again.filters.minEngagement,"5");
  assert.equal(again.owners.followerRanges,"manual");assert.equal(again.owners.minEngagement,"manual");
});

test("a topic matching only a creator name cannot manufacture a perfect Match", () => {
  const c={...candidate(),display_name:"skincare",bio:null};
  assert.equal(briefRanking(profile()).evaluate(c,request().filters).relevance.score,null);
});

test("subjective topic requests stay visible as unsupported and cannot affect Match", () => {
  const p=profile();p.validatedIntelligence.keywords=["sophisticated"];
  p.validatedIntelligence.fieldEvidence.keywords={level:"extracted",confidence:1};
  const mapped=mapCampaignIntelligenceToDiscoverySearch(p);
  assert.ok(mapped.requirements?.some(r=>r.value==="sophisticated"&&r.classification==="UNSUPPORTED"));
  assert.equal(briefRanking(p).evaluate(candidate(),request().filters).relevance.score,briefRanking(profile()).evaluate(candidate(),request().filters).relevance.score);
});
