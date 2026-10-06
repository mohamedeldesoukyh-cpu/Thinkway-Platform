import assert from "node:assert/strict";
import {test} from "node:test";
import {buildRateCardReportHtml} from "./report";
import {fixture} from "./report-test-fixture";

test("portrait badges show only the one, two or three included package platforms",()=>{
 for(const platforms of [["instagram"],["instagram","tiktok"],["instagram","tiktok","facebook"]]){
  const doc=structuredClone(fixture);doc.creators=doc.creators.slice(0,1);
  const creator=doc.creators[0];
  creator.group.platformLinks=[...platforms,"youtube"].map(platform=>({platform,label:platform,url:`https://${platform}.com/creator`}));
  creator.rates=[{...creator.rates[0],platform:"all",deliverable:"package",package_key:"reels",package_details:{name:"Reel package",reels:1,stories:0,profiles:platforms.map(platform=>({platform,profile_url:`https://${platform}.com/creator`}))}}];
  const html=buildRateCardReportHtml(doc,"creator-list");
  assert.equal((html.match(/class="pb-stack__item"/g)??[]).length,platforms.length);
  for(const platform of platforms)assert.ok(html.includes(`class="pb-stack__item" title="${platform}"`));
  assert.ok(!html.includes('class="pb-stack__item" title="youtube"'));
 }
});
