import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIoCoversLine, loadClientAcceptedLineIds } from "./client-acceptance";
import { isLineFirstTimeInvoiceEligible, isInvoiceLifecycleReopenable } from "./regeneration-eligibility";
import { analyzeIoCoverage } from "../operations/io-coverage";
import type { SupabaseClient } from "@supabase/supabase-js";
const io = { campaign_header_id: "c", status: "approved" };
test("acceptance is current, approved and scoped to accepted assignments", () => {
 assert.equal(clientIoCoversLine(io, "a"), true);
 for(const status of ["draft", "sent", "under_review", "cancelled", "rejected"]) assert.equal(clientIoCoversLine({...io,status}, "a"), false);
 assert.equal(clientIoCoversLine({...io,is_superseded:true}, "a"), false);
 const snapshot={version:1,capturedAt:"2026-10-18",selectedCampaignLineIds:["a"],lines:[],deliverables:[]};
 assert.equal(clientIoCoversLine({...io,assignment_snapshot:snapshot}, "a"), true);
 assert.equal(clientIoCoversLine({...io,assignment_snapshot:snapshot}, "b"), false);
 assert.equal(clientIoCoversLine({...io,assignment_snapshot:{}}, "a"), false);
});
test("newer unaccepted revision cannot fall back to older approval, and query failures fail closed", async () => {
 const db=(data:unknown[],error:unknown=null)=>({from:()=>({select:()=>({in:()=>({eq:()=>({order:async()=>({data,error})})})})})}) as unknown as SupabaseClient;
 assert.equal((await loadClientAcceptedLineIds(db([{...io,status:"sent"},io]),[{id:"a",campaign_header_id:"c"}])).size,0);
 await assert.rejects(()=>loadClientAcceptedLineIds(db([],{message:"unavailable"}),[{id:"a",campaign_header_id:"c"}]),/unavailable/);
});
test("accepted advance billing does not require vendor IO but requires remaining non-cancelled revenue",()=>{
 const line={client_io_approved:true,billing_status:"draft",billable_amount:1000,invoiced_amount:0};
 assert.equal(isLineFirstTimeInvoiceEligible(line),true);
 assert.equal(isLineFirstTimeInvoiceEligible({...line,client_io_approved:false}),false);
 assert.equal(isLineFirstTimeInvoiceEligible({...line,billing_status:"cancelled"}),false);
 assert.equal(isLineFirstTimeInvoiceEligible({...line,billable_amount:0}),false);
 assert.equal(isInvoiceLifecycleReopenable({...line,invoice_id:"invoice",invoice_status:"draft",regeneration_status:"pending_regeneration"}),true);
 const result=analyzeIoCoverage({currents:[{line_id:"a",line_name:"a",client_io_approved:true,vendor_io_id:null,active_vendor_io_id:null,vendor_io_document_number:null,influencer_id:"i",revenue_before_vat:1000,cost_before_vat:500,deliverables:[]}],baselines:new Map()});
 assert.equal(result.lines[0].category,"unchanged");
});
