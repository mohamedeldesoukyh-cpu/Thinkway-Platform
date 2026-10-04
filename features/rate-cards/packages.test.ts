import {test} from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {buildPackageTemplate,readRateWorkbook,buildRateTemplate,PACKAGE_HEADERS} from "./workbook";
import {validateWorkbookRow,previewPricingRule,previewApplication,type RateLine} from "./model";
import {parsePackageRow,packageDescription,packageStoryPlatforms} from "./packages";
import {rateTemplateRows} from "./template-rows";
import {buildRateCardReportHtml,scopePackageReportCreator} from "./report";
import {fixture} from "./report-test-fixture";
const match={ref:"inf:00000000-0000-4000-8000-000000000001",name:"Ahmed"};
export const packageRaw={"Profile URL 1":"https://instagram.com/ahmed","Profile URL 2":"https://tiktok.com/@ahmed","Profile URL 3":"https://facebook.com/ahmed","Package Code":"REEL-STORY","Package Name":"Reel + Story Package",Reels:"1",Stories:"1","Package Creator Cost":"70000","Creator Currency":"EGP","Package Client Price":"100000","Client Currency":"EGP","Usage Rights Monthly Client Price":"20000","Usage Rights Period (Months)":"1","Boosting Monthly Client Price":"10000","Boosting Period (Months)":"1"};
const lines=(raw=packageRaw)=>validateWorkbookRow(2,raw,match,["EGP"],new Set()).rates!.map((r,i)=>({...r,id:String(i),version_id:"version"})) as RateLine[];
test("separate package template accepts all three examples and preserves individual template",async()=>{
 const book=new ExcelJS.Workbook();await book.xlsx.load(await buildPackageTemplate(["EGP"]));
 assert.deepEqual((book.getWorksheet("Packages")!.getRow(1).values as string[]).slice(1),PACKAGE_HEADERS);
 const blank=await book.xlsx.writeBuffer();await assert.rejects(()=>readRateWorkbook(blank as ArrayBuffer));
 for(let n=2;n<=4;n++)book.getWorksheet("Packages")!.getRow(n).values=book.getWorksheet("Examples")!.getRow(n).values;
 const rows=await readRateWorkbook(await book.xlsx.writeBuffer() as ArrayBuffer);
 assert.equal(rows.length,3);
 const validated=rows.map(r=>validateWorkbookRow(r.row,r.raw,{...match,ref:match.ref.slice(0,-1)+r.row,name:r.raw["Creator Name"]},["EGP"],new Set()));
 assert.deepEqual(validated.map(r=>r.status),["ready","ready","ready"]);
 assert.deepEqual(validated.map(r=>r.rate!.amount),[100000,400000,700000]);
 assert.deepEqual(validated.map(r=>r.rate!.package_details!.profiles.length),[3,2,1]);
 const individual=new ExcelJS.Workbook();await individual.xlsx.load(await buildRateTemplate(["EGP"]));assert.equal(individual.getWorksheet("Rates")!.getCell("G1").text,"Deliverable Type");
});
test("one package price with separate monthly extras, even with three linked platforms",()=>{
 const rates=lines();assert.equal(rates.filter(r=>r.deliverable==="package"&&r.price_type==="client_price")[0].amount,100000);
 assert.equal(rates.length,4);assert.ok(rates.every(r=>r.package_key==="reel-story"&&r.platform==="all"));
 assert.deepEqual(packageStoryPlatforms(rates[0].package_details!),["instagram","facebook"]);
 assert.equal(packageDescription(rates[0].package_details!),"1 reel · mirrored to all linked platforms + 1 story");
 const table=rateTemplateRows(rates);assert.equal(table.length,1);assert.equal(table[0].base.client!.amount,100000);assert.equal(table[0].usage.client!.amount,20000);assert.equal(table[0].boost.client!.amount,10000);
});
test("package scope requires valid links, quantities and an IG/FB account for stories",()=>{
 for(const changes of [{Stories:"-1"},{Stories:"0.5"},{Reels:"0",Stories:"0"},{"Package Code":""},{"Package Name":""},{"Profile URL 1":"","Profile URL 3":""},{"Profile URL 1":"https://instagram.com/different" ,"Profile URL 3":"https://instagram.com/ahmed"}]){
  assert.equal(validateWorkbookRow(2,{...packageRaw,...changes},match,["EGP"],new Set()).status,"error");
 }
 const tt=parsePackageRow({...packageRaw,"Profile URL 1":"","Profile URL 3":"",Stories:"0"});assert.deepEqual(packageStoryPlatforms(tt.details),[]);
 const fb=parsePackageRow({...packageRaw,"Profile URL 1":"","Profile URL 2":""});assert.equal(packageDescription(fb.details),"1 reel + 1 story");
});
test("multiple packages remain distinct for the same creator, including extras and pricing rules",()=>{
 const seen=new Set<string>();assert.equal(validateWorkbookRow(2,packageRaw,match,["EGP"],seen).status,"ready");
 assert.equal(validateWorkbookRow(3,packageRaw,match,["EGP"],seen).status,"error");
 assert.equal(validateWorkbookRow(4,{...packageRaw,"Package Code":"premium"},match,["EGP"],seen).status,"ready");
 const rates=[...lines(),...lines({...packageRaw,"Package Code":"premium","Package Creator Cost":"200000","Package Client Price":"400000"})];
 assert.equal(rateTemplateRows(rates).length,2);
 const changes=previewPricingRule(rates,{mode:"cost_markup_pct",percent:10,agencyFee:null,overwrite:true});
 assert.deepEqual(changes.map(r=>r.rate.amount),[77000,220000]);assert.deepEqual(changes.map(r=>r.rate.package_key),["reel-story","premium"]);
});
test("package extras cannot be silently applied to standalone quotation prices",()=>{
 const rows=previewApplication([{id:"item",influencer_id:match.ref.slice(4),deliverables:[{platform:"instagram",type:"usage_right",type_lines:[{type:"usage_right",quantity:1,period_months:1}],quantity:1}]}] as never,lines(),"overwrite",undefined,"client_price");
 assert.equal(rows[0].status,"no_match");
});
test("client reports show only package platforms and one total, without internal costs or notes",()=>{
 const doc=structuredClone(fixture);doc.creators=doc.creators.slice(0,1);const c=doc.creators[0];c.rates=lines().filter(r=>r.price_type==="client_price");
 c.performance.push({...c.performance[0],platform:"youtube",followers:999999});
 const scoped=scopePackageReportCreator(c);assert.deepEqual(scoped.performance.map(p=>p.platform),["instagram","tiktok","facebook"]);
 for(const template of ["creator-list","creator-list-details"] as const){
  const html=buildRateCardReportHtml(doc,template);assert.equal((html.match(/EGP 100,000/g)??[]).length,1);assert.ok(!html.includes("EGP 70,000"));assert.ok(!html.includes("999,999"));assert.match(html,/1 reel · mirrored to all linked platforms \+ 1 story/);assert.match(html,/20,000 \/ month × 1 month/);assert.match(html,/Agency Fee not included/);
 }
});
