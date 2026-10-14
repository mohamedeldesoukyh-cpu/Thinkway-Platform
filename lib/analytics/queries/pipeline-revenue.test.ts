import test from "node:test";
import assert from "node:assert/strict";
import { buildPipelineRevenue, type PipelineIo } from "./pipeline-revenue";
const line = {id:"l",campaign_header_id:"c",currency_code:"AED",revenue_before_vat:1000,cost_before_vat:600};
const input = {lines:[line],deliverables:[{id:"d",campaign_line_id:"l",quantity:2,live_date:null,revenue_before_vat:1000,cost_before_vat:600,usage_rights_amount:0,usage_rights_cost:0,agency_fee_amount:0}],
posts:[{id:"p",assignment_deliverable_id:"d",status:"posted",live_date:"2026-09-01",revenue_before_vat:500,cost_before_vat:300},{id:"future",assignment_deliverable_id:"d",status:"draft",live_date:"2026-11-01",revenue_before_vat:500,cost_before_vat:300}],publications:[],rates:new Map([["EGP",1],["AED",14]]),campaignCurrencies:new Map([["c","EGP"]]),today:"2026-10-14"};
const io:PipelineIo={id:"io",campaign_header_id:"c",document_number:"CIO-1",status:"approved",is_superseded:false,approved_at:"2026-08-01",assignment_snapshot:null};
const selections=[{client_io_id:"io",campaign_line_id:"l"}];
test("pipeline is approved IO scope less live ads, converted to EGP excluding VAT",()=>{
 const [row]=buildPipelineRevenue(input,[io],selections);
 assert.equal(row.approved_revenue,14000);assert.equal(row.recognized_revenue,7000);assert.equal(row.pipeline_revenue,7000);
});
test("unapproved, superseded, unselected and fully live work is not pipeline",()=>{
 for(const candidate of [{...io,status:"sent"},{...io,is_superseded:true}]) assert.equal(buildPipelineRevenue(input,[candidate],selections).length,0);
 assert.equal(buildPipelineRevenue(input,[io],[]).length,0);
 assert.equal(buildPipelineRevenue({...input,posts:input.posts.map(p=>({...p,status:"posted",live_date:"2026-09-01"}))},[io],selections).length,0);
});
test("approved snapshots retain their prices and overlapping IOs do not double count",()=>{
 const frozen={...io,assignment_snapshot:{version:1,capturedAt:"2026-08-01",selectedCampaignLineIds:["l"],lines:[{...line,revenue_before_vat:800}],deliverables:[]}};
 const rows=buildPipelineRevenue(input,[frozen,{...io,id:"other"}],[...selections,{client_io_id:"other",campaign_line_id:"l"}]);
 assert.equal(rows.length,1);assert.equal(rows[0].pipeline_revenue,5600);
});
