import test from "node:test";
import assert from "node:assert/strict";
import { failedMailPreparation, prepareFinanceMailContent, processFinanceMailCycle } from "./mail-preparation";
import { FinanceMailRequestError } from "./mail-request";
import type { FinanceReply } from "./contracts";
import { automaticReplyPayload } from "./auto-reply-policy";
import { FINANCE_OWNER } from "./approval-policy";
import { randomUUID } from "node:crypto";

const reply:FinanceReply={content:"November client revenue summary.",retrievedAt:"2026-11-24T14:00:00Z",sources:[{title:"Revenue by client",scope:"November 2026, EGP",href:"/accounting",facts:{},tables:[{heading:"Clients",columns:["Client","Revenue"],rows:[["Client A","10.00"]]}]}]};
test("report email contains concise explanation and PDF, not duplicated rows",async()=>{
 let called=0;
 const result=await prepareFinanceMailContent(reply,false,async evidence=>{called++;assert.equal(evidence,reply.sources[0]);return Buffer.from("%PDF-fixture");});
 assert.equal(called,1);assert.equal(result.attachments.length,1);
 assert.match(result.response_text,/PDF is attached/);assert.doesNotMatch(result.response_text,/Client A/);
});
test("clarifications have no PDF claim and attachments are explicitly unprocessed",async()=>{
 const result=await prepareFinanceMailContent({...reply,sources:[]},true,async()=>{throw Error("must not render");});
 assert.equal(result.attachments.length,0);assert.doesNotMatch(result.response_text,/PDF is attached/);assert.match(result.response_text,/have not reviewed the attached documents/);
});
test("PDF failure never returns a partial successful reply",async()=>{
 await assert.rejects(prepareFinanceMailContent(reply,0,async()=>{throw Error("renderer failed");}));
 assert.equal(failedMailPreparation(Error("private internals"),"pdf",1).status,"queued");
 const failure=failedMailPreparation(Error("private internals"),"pdf",3);
 assert.equal(failure.status,"prepared");assert.match(failure.response_text??"",/could not generate/);
 assert.doesNotMatch(failure.response_text??"",/private internals/);assert.deepEqual(failure.attachments,[]);
});
test("permanent invalid request gets a bounded clarification immediately; transient failures retry",()=>{
 for(const code of ["empty_request","request_too_long","message_too_large"] as const){
  const result=failedMailPreparation(new FinanceMailRequestError(code),"request",1);
  assert.equal(result.status,"prepared");assert.ok((result.response_text?.length??0)<1500);
 }
 assert.equal(failedMailPreparation(Error(),"report",2).status,"queued");
 assert.equal(failedMailPreparation(Error(),"report",3).status,"prepared");
});
test("failure notices use identical owner-only authenticated delivery restrictions",()=>{
 const result=failedMailPreparation(Error(),"report",3);
 const mail={id:randomUUID(),direction:"inbound" as const,from:FINANCE_OWNER,message_id:"<owner>",subject:"Report",text:"Report",reply_to:[]};
 const received={...mail,authentication:{dkim:"pass",dmarc:"pass"}};
 const job={id:randomUUID(),email_id:mail.id,thread_id:randomUUID(),sender:FINANCE_OWNER,response_text:result.response_text!,attachments:[]};
 const payload=automaticReplyPayload(job,mail,received);
 assert.deepEqual(payload.cc,[]);assert.deepEqual(payload.bcc,[]);assert.equal(payload.reply_all,false);
 assert.throws(()=>automaticReplyPayload(job,mail,{...received,authentication:{dkim:"pass",dmarc:"fail"}}));
});
test("queue preparation outage does not block ready delivery",async()=>{
 let sent=false;
 const result=await processFinanceMailCycle(async()=>{throw Error("database transient");},async()=>{sent=true;return {sent:1};});
 assert.equal(sent,true);assert.deepEqual(result.delivery,{sent:1});
 assert.deepEqual(result.preparation,{error:"preparation_unavailable"});
});
