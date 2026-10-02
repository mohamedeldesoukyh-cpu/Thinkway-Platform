import assert from "node:assert/strict";
import {test} from "node:test";
import {buildRateCardReportHtml,safeProfileUrl,type RateCardReport} from "./report";
import type {ShortlistDocCreatorGroup} from "@/features/discovery/shortlists/export/shortlist-document";
const group:ShortlistDocCreatorGroup={creatorKey:"inf:test",rank:1,creator:"Creator <script>alert(1)</script>",handle:"@creator",avatarUrl:null,avatarProfileUrl:null,avatarProxyUrl:null,profileUrl:"https://www.instagram.com/creator/",platformLinks:[{platform:"instagram",url:"https://www.instagram.com/creator/",label:"Instagram"}],platform:"Instagram",platformMetrics:[],followers:"10K",followersNumeric:10000,engagementRate:"3%",engagementRateNumeric:3,country:"Egypt",tier:"Micro",categories:["Lifestyle"],isVerified:false,interests:"",brandSafety:"",status:"",notes:"internal private notes",matchScore:"",publicationShots:[]};
export const fixture:RateCardReport={name:"Client Rate Card",version:"V1",client:"Test client",brand:null,effective:null,expiry:null,creators:Array.from({length:8},(_,i)=>({group:{...group,creatorKey:`creator-${i}`,creator:i===0?group.creator:`Creator ${i+1} — A long creator name for overflow testing`,handle:`@creator${i+1}`},rates:Array.from({length:i===0?8:3},(_,j)=>({platform:"instagram",deliverable:"instagram_reel",amount:1234567.89+j,currency:"EGP",agency_fee_percent:10})),performance:[{platform:"instagram",followers:120000,engagement:3.5,views:14000,likes:3200,comments:80,audienceCountry:"EG",profileUrl:group.profileUrl}]}))};
test("both reports paginate every creator and every rate without exposing private notes",()=>{
 for(const template of ["creator-list","creator-list-details"] as const){const html=buildRateCardReportHtml(fixture,template);assert.ok(html.includes('href="https://www.instagram.com/creator/"'));assert.ok(html.includes("&lt;script&gt;"));assert.ok(!html.includes("internal private notes"));assert.equal((html.match(/class="creator-card/g)||[]).length,8);assert.ok(!html.includes("Continued"));assert.equal((html.match(/class="price"/g)||[]).length,29);assert.equal((html.match(/class="page(?: page--(?:cov|end))?"/g)||[]).length,template==="creator-list"?5:10);}
});
test("Arabic exports and unsafe profile links",()=>{
 assert.ok(buildRateCardReportHtml(fixture,"creator-list-details","ar").includes('dir="rtl"'));
 assert.equal(safeProfileUrl("javascript:alert(1)"),null);assert.equal(safeProfileUrl("data:text/html,hello"),null);
});
test("details show one performance card per creator without continued duplicates",()=>{
 const html=buildRateCardReportHtml(fixture,"creator-list-details");
 assert.ok(!html.includes("Performance data is not available yet"));
 assert.equal((html.match(/120K/g)||[]).length,8);
});
test("monthly report prices show rate, duration and extended total separately",()=>{
 const doc=structuredClone(fixture);doc.creators[0].rates=[{platform:"instagram",deliverable:"usage_right",amount:100,currency:"EGP",agency_fee_percent:10,period_months:2},{platform:"instagram",deliverable:"boosting",amount:50,currency:"EGP",agency_fee_percent:null,period_months:1},{platform:"instagram",deliverable:"event_attendance",amount:300,currency:"EGP",agency_fee_percent:null}];
 const html=buildRateCardReportHtml(doc,"creator-list");assert.match(html,/EGP 200/);assert.match(html,/100 \/ month × 2 months/);assert.match(html,/EGP 220/);assert.match(html,/Event Attendance/);
});
