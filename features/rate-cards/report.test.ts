import assert from "node:assert/strict";
import {test} from "node:test";
import {buildRateCardReportHtml,safeProfileUrl} from "./report";
import {fixture} from "./report-test-fixture";

test("Client List by Name preserves creator order and performance without commercial content",()=>{
 const doc=structuredClone(fixture);
 doc.creators[0].group.creator="Zara";doc.creators[1].group.creator="Amal";
 doc.creators[0].rates[0].tu_a_percent=987;
 for(const lang of ["en","ar"] as const){
  const html=buildRateCardReportHtml(doc,"client-list-by-name",lang);
  assert.ok(html.indexOf("Zara")<html.indexOf("Amal"));
  assert.equal((html.match(/class="creator-card/g)||[]).length,8);
  assert.match(html,/120K/);assert.match(html,/3.5%|٣٫٥%/);assert.match(html,/3.2K|٣٫٢K/);
  assert.ok(html.includes('href="https://www.instagram.com/creator/"'));
  for(const hidden of ['class="price"','rate-list-heading-prices">','class="rate-closing-note"',"EGP","1,234,567.89","Agency Fee not included","Client selling prices only","travel-uplift\"><", "internal private notes"]){
   assert.ok(!html.includes(hidden),`Must not include ${hidden}`);
  }
  assert.ok(html.includes(lang==="en"?"Client List by Name":"قائمة العميل بالأسماء"));
  assert.ok(html.includes(lang==="en"?"Average views":"متوسط المشاهدات"));
  assert.ok(html.includes(lang==="en"?"Average comments":"متوسط التعليقات"));
 }
});

test("performance-only package reports retain individually selected platform links",()=>{
 const doc=structuredClone(fixture);doc.creators=doc.creators.slice(0,1);
 const c=doc.creators[0];c.rates=[];c.platformScopes=["instagram"];
 c.packageScopes=[{name:"Video package",reels:1,stories:0,profiles:[{platform:"tiktok",profile_url:"https://www.tiktok.com/@creator"}]}];
 const html=buildRateCardReportHtml(doc,"client-list-by-name");
 assert.match(html,/href="https:\/\/www.instagram.com\/creator\/"/);
 assert.match(html,/href="https:\/\/www.tiktok.com\/@creator"/);
 assert.match(html,/120K/);
});
test("creator list shows compact metrics beneath each platform and uses the profile avatar for the portrait",()=>{
 const doc=structuredClone(fixture);doc.creators=doc.creators.slice(0,1);
 const creator=doc.creators[0];creator.group.avatarUrl="data:image/png;base64,aGVsbG8=";
 creator.group.publicationShots=[{imageUrl:"https://example.com/video-thumbnail.jpg"}] as typeof creator.group.publicationShots;
 creator.group.platformLinks.push({platform:"tiktok",label:"TikTok",url:"https://tiktok.com/@creator"});
 creator.performance.push({...creator.performance[0],platform:"tiktok",followers:1500000,engagement:null,likes:null});
 const html=buildRateCardReportHtml(doc,"creator-list");
 assert.equal((html.match(/class="rate-platform-summary"/g)||[]).length,2);
 assert.match(html,/Followers: <b>120K<\/b> · ER: <b>3.5%<\/b> · Avg Likes: <b>3.2K<\/b>/);
 assert.match(html,/Followers: <b>1.5M<\/b> · ER: <b>—<\/b> · Avg Likes: <b>—<\/b>/);
 assert.ok(html.includes('src="data:image/png;base64,aGVsbG8="'));assert.ok(!html.includes("video-thumbnail.jpg"));
 assert.ok(!buildRateCardReportHtml(doc,"creator-list-details").includes('class="rate-platform-summary"'));
});
test("both reports paginate every creator and every rate without exposing private notes",()=>{
 for(const template of ["creator-list","creator-list-details"] as const){const html=buildRateCardReportHtml(fixture,template);assert.ok(html.includes('href="https://www.instagram.com/creator/"'));assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("internal private notes"));assert.equal((html.match(/class="creator-card/g)||[]).length,8);assert.ok(!html.includes("Continued"));assert.equal((html.match(/class="price"/g)||[]).length,29);assert.equal((html.match(/class="page(?: page--(?:cov|end))?"/g)||[]).length,template==="creator-list"?4:6);}
});
test("Arabic exports and unsafe profile links",()=>{
 assert.ok(buildRateCardReportHtml(fixture,"creator-list-details","ar").includes('dir="rtl"'));
 assert.equal(safeProfileUrl("javascript:alert(1)"),null);assert.equal(safeProfileUrl("data:text/html,hello"),null);
});
test("details show one performance card per creator without continued duplicates",()=>{
 const html=buildRateCardReportHtml(fixture,"creator-list-details");
 assert.ok(!html.includes("Performance data is not available yet"));
 assert.equal((html.match(/120K/g)||[]).length,8);
 assert.ok(html.includes("Rate card"));assert.ok(!html.includes("Audience country"));
});
test("All Platforms prices show linked icons without duplicating prices",()=>{
 const doc=structuredClone(fixture);doc.creators[0].rates=[{platform:"all",deliverable:"reel",amount:100,currency:"EGP",agency_fee_percent:null}];
 doc.creators[0].group.platformLinks.push({platform:"tiktok",label:"TikTok",url:"https://tiktok.com/@creator"});
 const html=buildRateCardReportHtml(doc,"creator-list-details");
 assert.match(html,/<span><img class="rate-platform-icon"[^>]+><img class="rate-platform-icon"[^>]+>All Platforms/);
});
test("monthly report prices show rate, duration and extended total separately",()=>{
 const doc=structuredClone(fixture);doc.creators[0].rates=[{platform:"instagram",deliverable:"usage_right",amount:100,currency:"EGP",agency_fee_percent:10,period_months:2},{platform:"instagram",deliverable:"boosting",amount:50,currency:"EGP",agency_fee_percent:null,period_months:1},{platform:"instagram",deliverable:"event_attendance",amount:300,currency:"EGP",agency_fee_percent:null}];
 const html=buildRateCardReportHtml(doc,"creator-list");assert.match(html,/EGP 200/);assert.match(html,/100 \/ month × 2 months/);assert.ok(!html.includes("EGP 220"));assert.match(html,/Agency Fee not included/);assert.match(html,/Event Attendance/);
});
