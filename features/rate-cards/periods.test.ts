import assert from "node:assert/strict";
import {test} from "node:test";
import {previewApplication,validateWorkbookRow,type RateLine,type MatchItem} from "./model";
import {buildAppliedCommercials} from "./application";
import {deliverableTypeLines,typeLinesFromSelectedTypes,typeLinesAutoDescription} from "@/lib/quotations/quotation-deliverable-types";
import {normalizeDeliverablesForCompare} from "@/lib/quotations/quotation-line-pending-diff";
const ref="inf:00000000-0000-4000-8000-000000000001";
const base={version_id:"v",creator_ref:ref,creator_name:"Creator",platform:"instagram",currency:"EGP",notes:"",agency_fee_percent:10};
const rates:RateLine[]=["creator_cost","client_price"].flatMap((price_type,i)=>["instagram_reel","usage_right","boosting","event_attendance"].map((deliverable,j)=>({...base,id:`${i}:${j}`,price_type:price_type as RateLine["price_type"],deliverable,amount:[1000,100,50,300][j]*(i+1),period_months:j===1?2:j===2?1:0})));
const item:MatchItem&{cost_currency:string}={id:"item",unified_id:ref,cost_currency:"EGP",cost:null,revenue:0,deliverables:[{platform:"instagram",type:"instagram_reel",types:["instagram_reel","usage_right","boosting"],type_lines:[{type:"instagram_reel",quantity:1},{type:"usage_right",quantity:1,period_months:2},{type:"boosting",quantity:1,period_months:1}],quantity:1,cost:null,revenue:null}]};
test("reel + UR two months + boosting one month sums each monthly component independently",()=>{
 const rows=previewApplication([item],rates,"overwrite",undefined,"both");
 assert.equal(rows[0].after,1250);assert.equal(rows[1].after,2500);
 assert.deepEqual(rows[0].components?.map(c=>c.amount),[1000,200,50]);
 const applied=buildAppliedCommercials(item,rows,new Map([["EGP",1]]));
 assert.equal(applied.cost,1250);assert.equal(applied.revenue,2500);assert.equal(applied.deliverables[0].type_lines?.[1].period_months,2);
});
test("changed duration uses monthly price; missing duration or any missing component blocks partial application",()=>{
 const changed=structuredClone(item);changed.deliverables[0].type_lines![1].period_months=3;
 assert.equal(previewApplication([changed],rates,"overwrite")[0].after,1350);
 changed.deliverables[0].type_lines![1].period_months=null;
 assert.equal(previewApplication([changed],rates,"overwrite")[0].status,"no_match");
 assert.equal(previewApplication([item],rates.filter(r=>r.deliverable!=="boosting"),"overwrite")[0].status,"no_match");
});
test("period survives selector normalization and changes are detected for quotation Save",()=>{
 const lines=deliverableTypeLines(item.deliverables[0]);assert.equal(lines[1].period_months,2);
 assert.equal(typeLinesFromSelectedTypes(["usage_right"],lines)[0].period_months,2);
 assert.match(typeLinesAutoDescription(lines),/2 months/);
 const changed=structuredClone(item.deliverables);changed[0].type_lines![1].period_months=3;
 assert.notEqual(normalizeDeliverablesForCompare(item.deliverables),normalizeDeliverablesForCompare(changed));
});
test("wide template imports separate monthly cost/client rates and attendance without a base price",()=>{
 const row=validateWorkbookRow(2,{Platform:"instagram","Creator Currency":"EGP","Client Currency":"EGP","Usage Rights Monthly Creator Cost":"100","Usage Rights Monthly Client Price":"200","Usage Rights Period (Months)":"2 months","Boosting Monthly Creator Cost":"50","Boosting Period (Months)":"1","Event Attendance Client Price":"600"},{ref,name:"Creator"},["EGP"],new Set());
 assert.equal(row.status,"ready");assert.equal(row.rates?.length,4);assert.equal(row.rates?.[0].period_months,2);
 assert.equal(row.rates?.at(-1)?.deliverable,"event_attendance");
});
