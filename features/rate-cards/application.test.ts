import assert from "node:assert/strict";
import {test} from "node:test";
import {buildAppliedCommercials} from "./application";
import {previewApplication,previewPricingRule,validateWorkbookRow,type RateLine,type MatchItem} from "./model";
const creator_ref="inf:00000000-0000-4000-8000-000000000001";
const cost:RateLine={id:"cost",version_id:"v",creator_ref,creator_name:"Creator",platform:"instagram",deliverable:"instagram_reel",amount:100,currency:"USD",notes:"",price_type:"creator_cost",agency_fee_percent:null};
const price:RateLine={...cost,id:"price",price_type:"client_price",amount:200,agency_fee_percent:10};
const fx=new Map([["USD",50],["EGP",1]]);
const base:MatchItem & {cost_currency:string}={id:"i",unified_id:creator_ref,cost:3000,revenue:5000,cost_currency:"EGP",af_pct:5,deliverables:[{platform:"instagram",type:"instagram_reel",quantity:2,cost:30,cost_currency:"USD",commercial_input_mode:"cost_revenue",revenue:100,af_pct:5}]};
test("both prices independently apply with quantities, fees, FX, and immutable inputs",()=>{
 const before=structuredClone(base);const rows=previewApplication([base],[cost,price],"overwrite",undefined,"both");
 const result=buildAppliedCommercials(base,rows,fx);
 assert.equal(result.cost,10000);assert.equal(result.revenue,20000);assert.equal(result.af_pct,10);
 assert.equal(result.deliverables[0].cost,100);assert.equal(result.deliverables[0].revenue,400);assert.equal(result.deliverables[0].gp_pct,50);assert.deepEqual(base,before);
});
test("cost-only preserves existing revenue and client-only preserves existing cost and entry currency",()=>{
 const a=buildAppliedCommercials(base,previewApplication([base],[cost],"overwrite"),fx);
 assert.equal(a.revenue,5000);assert.equal(a.deliverables[0].revenue,100);assert.equal(a.af_pct,5);
 const b=buildAppliedCommercials(base,previewApplication([base],[price],"overwrite",undefined,"client_price"),fx);
 assert.equal(b.cost,3000);assert.equal(b.deliverables[0].cost,30);assert.equal(b.deliverables[0].cost_currency,"USD");
});
test("single-sided prices never invent the absent counterpart",()=>{
 const blank={...base,cost:null,revenue:null,af_pct:null,deliverables:[{...base.deliverables[0],cost:null,revenue:null,af_pct:null}]};
 const a=buildAppliedCommercials(blank,previewApplication([blank],[cost],"missing",undefined,"both").filter(r=>r.status==="fill"),fx);
 assert.equal(a.deliverables[0].revenue,null);
 const b=buildAppliedCommercials(blank,previewApplication([blank],[price],"missing",undefined,"both").filter(r=>r.status==="fill"),fx);
 assert.equal(b.deliverables[0].cost,null);assert.equal(b.deliverables[0].revenue,400);
});
test("missing-only protects master fees and zero prices; fee-only preserves amount",()=>{
 const rows=previewApplication([{...base,deliverables:[{...base.deliverables[0],af_pct:null,revenue:0}]}],[price],"missing",undefined,"client_price");
 assert.equal(rows[0].status,"unchanged");
 const missingFee={...base,af_pct:null,deliverables:[{...base.deliverables[0],af_pct:null}]};
 const feeRows=previewApplication([missingFee],[price],"missing",undefined,"client_price");
 assert.equal(feeRows[0].apply_amount,false);assert.equal(feeRows[0].apply_fee,true);
 const r=buildAppliedCommercials(missingFee,feeRows,fx);assert.equal(r.revenue,5000);assert.equal(r.af_pct,10);
});
test("optional pricing uses existing engine for margin and markup and requires valid percentages",()=>{
 assert.equal(previewPricingRule([cost],{mode:"cost_gp_pct",percent:20,agencyFee:10,overwrite:false})[0].rate.amount,125);
 assert.equal(previewPricingRule([cost],{mode:"cost_markup_pct",percent:20,agencyFee:null,overwrite:false})[0].rate.amount,120);
 assert.equal(previewPricingRule([cost,price],{mode:"cost_gp_pct",percent:20,agencyFee:null,overwrite:false}).length,0);
 assert.equal(previewPricingRule([price],{mode:"none",percent:0,agencyFee:20,overwrite:false}).length,0);
 assert.throws(()=>previewPricingRule([cost],{mode:"cost_gp_pct",percent:100,agencyFee:null,overwrite:true}));
});
test("wide import accepts independent rates, derives percentages, rejects duplicates and invalid fields",()=>{
 const raw={"Creator Name":"Creator",Platform:"instagram","Deliverable Type":"instagram_reel","Creator Cost":"100","Creator Currency":"USD","Client Selling Price":"125","Client Currency":"USD","Agency Fee %":"10"};
 const match={ref:creator_ref,name:"Creator"},seen=new Set<string>();
 const r=validateWorkbookRow(2,raw,match,["USD","EGP"],seen);assert.equal(r.rates?.length,2);assert.equal(r.gp_percent,20);assert.equal(r.markup_percent,25);
 assert.equal(validateWorkbookRow(3,raw,match,["USD"],seen).issues[0],"duplicate");
 for(const patch of [{"Creator Cost":""},{"Client Selling Price":""}])assert.equal(validateWorkbookRow(2,{...raw,...patch},match,["USD"],new Set()).status,"ready");
 assert.equal(validateWorkbookRow(2,{...raw,"Client Currency":"EGP"},match,["USD","EGP"],new Set()).gp_percent,null);
 for(const patch of [{"Creator Cost":"","Client Selling Price":""},{"Agency Fee %":"101"},{"Creator Cost":"-4"}])assert.equal(validateWorkbookRow(2,{...raw,...patch},match,["USD"],new Set()).status,"error");
});
