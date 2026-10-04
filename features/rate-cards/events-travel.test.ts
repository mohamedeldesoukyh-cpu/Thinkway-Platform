import {test} from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {buildPackageTemplate,buildRateTemplate,readRateWorkbook} from "./workbook";
import {validateWorkbookRow,previewPricingRule,type RateLine} from "./model";
import {buildRateCardReportHtml} from "./report";
import {fixture} from "./report-test-fixture";
import {travelSchema} from "./travel";
const match={ref:"inf:00000000-0000-4000-8000-000000000001",name:"Ahmed"};
const raw={"Profile URL 1":"https://instagram.com/ahmed","Package Code":"reel-story","Package Name":"Reel + Story",Reels:"1",Stories:"1","Package Client Price":"100000","Client Currency":"EGP","Creator Currency":"EGP","Event Attendance Creator Cost":"5000","Event Attendance Client Price":"8000","Event Days":"3"};
test("both templates import daily event prices and days, with no travel columns",async()=>{
 for(const packageFile of [true,false]){
  const book=new ExcelJS.Workbook();await book.xlsx.load(await (packageFile?buildPackageTemplate:buildRateTemplate)(["EGP"]));
  const sheet=book.worksheets[0],headers=(sheet.getRow(1).values as string[]).slice(1);
  assert.ok(headers.includes("Event Days"));assert.ok(headers.includes("Event Attendance Client Price"));assert.ok(!headers.some(h=>/TU|Travel/.test(h)));
  const input:Record<string,string>=packageFile?raw:{...raw,Platform:"instagram","Deliverable Type":"instagram_reel","Client Selling Price":"100000"};
  sheet.getRow(2).values=headers.map(h=>input[h]??"");
  const rows=await readRateWorkbook(await book.xlsx.writeBuffer() as ArrayBuffer);
  const parsed=validateWorkbookRow(2,rows[0].raw,match,["EGP"],new Set());assert.equal(parsed.status,"ready");
  const events=parsed.rates!.filter(r=>r.deliverable==="event_attendance");assert.equal(events.length,2);assert.deepEqual(events.map(r=>[r.amount,r.event_days]),[[5000,3],[8000,3]]);
 }
});
test("event days default to one for legacy uploads and reject invalid durations",()=>{
 const parse=(days:string)=>validateWorkbookRow(2,{...raw,"Event Days":days},match,["EGP"],new Set());
 assert.equal(parse("").rates!.find(r=>r.deliverable==="event_attendance")!.event_days,1);
 for(const days of ["0","-1","1.5","366","text"])assert.equal(parse(days).status,"error",days);
 for(const bad of [-1,Infinity,10001])assert.equal(travelSchema.safeParse({tu_a_percent:bad}).success,false);
 assert.equal(travelSchema.safeParse({tu_a_percent:0,tu_b_percent:15.5,itu_percent:null}).success,true);
});
test("all client reports label package price, extend daily event rates, and keep uplifts separate",()=>{
 const parsed=validateWorkbookRow(2,raw,match,["EGP"],new Set());
 const doc=structuredClone(fixture);doc.creators=doc.creators.slice(0,1);
 doc.creators[0].rates=parsed.rates!.filter(r=>r.price_type==="client_price").map(r=>({...r,tu_a_percent:10,tu_b_percent:20,itu_percent:0}));
 for(const template of ["creator-list","creator-list-details"] as const){
  const html=buildRateCardReportHtml(doc,template);
  assert.match(html,/<strong class="package-price-label">Package Price<\/strong>/);
  assert.match(html,/EGP 100,000/);assert.match(html,/EGP 24,000/);assert.match(html,/EGP 8,000 \/ day × 3 days/);
  assert.equal((html.match(/Travel Uplift – Alex \/ North Coast \/ Ain Sokhna: 10%/g)||[]).length,1);
  assert.match(html,/Travel Uplift – Red Sea \/ Sharm \/ Upper Egypt: 20%/);assert.match(html,/International Travel Uplift: 0%/);
  assert.ok(!html.includes("EGP 110,000"));assert.ok(!html.includes("EGP 5,000"));
 }
});
