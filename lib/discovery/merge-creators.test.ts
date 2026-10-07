import assert from "node:assert/strict";
import test from "node:test";

import { classifyMergeReassignError, evaluateMergeCreatorsEligibility,getMergeCreatorsEligibility } from "./merge-creators";

test("replacement preserves overlapping jobs and requests review for overlapping prices",async()=>{
 for(const overlap of ["vendor_ios","rate_card_lines"]){
  const db={from(table:string){const data=table==="influencer_platform_accounts"?[{id:"p1",platform:"instagram",influencer_id:"target"},{id:"p2",platform:"tiktok",influencer_id:"source"}]:table===overlap?[{id:"a",influencer_id:"target",campaign_header_id:"job",version_id:"version",platform:"all",deliverable:"reel",price_type:"creator_cost"},{id:"b",influencer_id:"source",campaign_header_id:"job",version_id:"version",platform:"all",deliverable:"reel",price_type:"creator_cost"}]:[];const q={select(){return q;},in(){return q;},eq(){return q;},order(){return q;},range(){return q;},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data,error:null}).then(resolve);}};return q;}};
  const result=await getMergeCreatorsEligibility(db as unknown as Parameters<typeof getMergeCreatorsEligibility>[0],{targetInfluencerId:"target",sourceInfluencerId:"source"});
  assert.equal(result.canMerge,overlap !== "rate_card_lines");if(overlap === "rate_card_lines")assert.match(result.message,/same rate card/);
 }
});

test("evaluateMergeCreatorsEligibility allows complementary platforms", () => {
  const result = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "instagram" }],
    sourcePlatforms: [{ platform: "tiktok" }],
  });

  assert.equal(result.canMerge, true);
  assert.deepEqual(result.platformsToMove, ["tiktok"]);
  assert.deepEqual(result.platformConflicts, []);
});

test("evaluateMergeCreatorsEligibility retains overlapping platform accounts during replacement", () => {
  const result = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "instagram" }, { platform: "tiktok" }],
    sourcePlatforms: [{ platform: "tiktok" }, { platform: "youtube" }],
  });

  assert.equal(result.canMerge, true);
  assert.deepEqual(result.platformConflicts, ["TikTok"]);
  assert.deepEqual(result.platformsToMove, ["youtube"]);
});

test("evaluateMergeCreatorsEligibility supports history transfer without a new platform", () => {
  const result = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "instagram" }, { platform: "tiktok" }],
    sourcePlatforms: [{ platform: "instagram" }],
  });

  assert.equal(result.canMerge, true);
  assert.match(result.message, /Keep all existing accounts/i);
});

test("evaluateMergeCreatorsEligibility treats mixed-case platforms as the same", () => {
  const conflict = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "Snapchat" }],
    sourcePlatforms: [{ platform: "snapchat" }],
  });
  assert.equal(conflict.canMerge, true);
  assert.ok(conflict.platformConflicts.length > 0);

  const complementary = evaluateMergeCreatorsEligibility({
    targetPlatforms: [{ platform: "Instagram" }],
    sourcePlatforms: [{ platform: "Snapchat" }],
  });
  assert.equal(complementary.canMerge, true);
  assert.deepEqual(complementary.platformsToMove, ["snapchat"]);
});

test("classifyMergeReassignError treats unique and missing-table errors as recoverable", () => {
  assert.equal(
    classifyMergeReassignError(
      'duplicate key value violates unique constraint "creator_intelligence_monthly_metrics_unique"'
    ),
    "unique"
  );
  assert.equal(
    classifyMergeReassignError("Could not find the table 'public.vendor_statements' in the schema cache"),
    "missing"
  );
  assert.equal(
    classifyMergeReassignError("permission denied for table creator_enrichment_runs"),
    "fatal"
  );
});

test("overlapping saved shortlist entries do not block a lossless merge",async()=>{
 for(const cost of [null,0,100]){
  const db={from(table:string){const data=table==="influencer_platform_accounts"?[{id:"p1",platform:"instagram",influencer_id:"target"},{id:"p2",platform:"tiktok",influencer_id:"source"}]:table==="discovery_shortlist_items"?[{id:"a",influencer_id:"target",shortlist_id:"list",item_status:"draft",deliverables:[]},{id:"b",influencer_id:"source",shortlist_id:"list",item_status:"draft",deliverables:[],cost}]:[];const q={select(){return q;},in(){return q;},eq(){return q;},order(){return q;},range(){return q;},then(resolve:(value:unknown)=>unknown){return Promise.resolve({data,error:null}).then(resolve);}};return q;}};
  const result=await getMergeCreatorsEligibility(db as unknown as Parameters<typeof getMergeCreatorsEligibility>[0],{targetInfluencerId:"target",sourceInfluencerId:"source"});
  assert.equal(result.canMerge,true);
 }
});
