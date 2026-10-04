import assert from "node:assert/strict";
import { test } from "node:test";
import { signalsFromCampaignWorkspace } from "@/features/campaigns/lifecycle/campaign-process-presentation";
import { decisionObjectsFromWorkspace } from "@/features/campaigns/lifecycle/campaign-decision-center";
import { isActiveVendorIo } from "./active-vendor-io";
import type { CampaignWorkspace } from "@/features/campaigns/types";

test("six approved IOs and a cancelled manual IO produce no pending active IO", () => {
 const rows = [...Array.from({length:6}, (_,i)=>({id:String(i),status:"approved",document_number:String(i),influencer_name:"Creator"})), {id:"cancelled",status:"cancelled",document_number:"VIO-2026-48",influencer_name:"Removed",delivery_method:"manual",attachment_url:null}, {id:"old",status:"sent",is_superseded:true,document_number:"Old",influencer_name:"Creator"}];
 const workspace={status:"active",lines:[],client_io:{status:"approved"},vendor_ios:rows,deliverables:[],invoices:[],financials:{billing_outstanding:0,po_exceeded:false},blockers:[]} as unknown as CampaignWorkspace;
 const signals=signalsFromCampaignWorkspace(workspace);
 assert.equal(signals.vendorIoCount,6);
 assert.equal(signals.approvedVendorIoCount,6);
 assert.equal(signals.sentVendorIoCount,0);
 const objects=decisionObjectsFromWorkspace(workspace);
 assert.equal(objects.vendorIos.length,6);
 assert.ok(objects.vendorIos.every(row=>row.status==='approved'));
 assert.equal(rows.length,8, "historical IOs are retained");
});
test("active sent IO still needs follow-up", () => {
 assert.equal(isActiveVendorIo({status:"sent"}),true);
 assert.equal(isActiveVendorIo({status:"cancelled"}),false);
 assert.equal(isActiveVendorIo({status:"sent",is_superseded:true}),false);
});
