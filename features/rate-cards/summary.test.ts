import assert from "node:assert/strict";
import {test} from "node:test";
import {summarizeRateCard,type SummaryLine} from "./summary";
import {loadRateCardSummary} from "./summary-data";

test("summary counts creators and platform memberships once across packages and rate types",()=>{
 const pack:SummaryLine={creator_ref:"inf:a",platform:"all",package_details:{profiles:[{platform:"instagram"},{platform:"tiktok"}]}};
 const lines=[pack,pack,pack,{creator_ref:"inf:a",platform:"instagram",package_details:null},{creator_ref:"inf:b",platform:"facebook",package_details:null},{creator_ref:"inf:c",platform:"all",package_details:null}];
 assert.deepEqual(summarizeRateCard(lines,{"inf:a":["youtube"],"inf:c":["tiktok","tiktok","facebook"]}),{creators:3,accounts:5,platforms:{instagram:1,tiktok:2,facebook:2}});
 assert.deepEqual(summarizeRateCard([]),{creators:0,accounts:0,platforms:{}});
 assert.deepEqual(summarizeRateCard([{creator_ref:"inf:a",platform:"all",package_details:null}]),{creators:1,accounts:0,platforms:{}});
});

test("summary reads all pricing pages rather than only the visible page or first 1000 lines",async()=>{
 const lines=Array.from({length:1100},(_,i)=>({creator_ref:`inf:${i}`,platform:"instagram",package_details:null}));
 const ranges:number[]=[];
 const query={select:()=>query,eq:()=>query,order:()=>query,range:async(from:number,to:number)=>{ranges.push(from);return {data:lines.slice(from,to+1),error:null};}};
 const summary=await loadRateCardSummary({from:()=>query} as never,"version");
 assert.deepEqual(ranges,[0,1000]);
 assert.deepEqual(summary,{creators:1100,accounts:1100,platforms:{instagram:1100}});
});
