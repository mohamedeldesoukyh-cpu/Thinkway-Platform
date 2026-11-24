import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {automaticReplyPayload,deliverAutomaticReply,verifyAutomaticRequest} from "./auto-reply-policy";
import {FINANCE_OWNER,isFinanceOwner} from "./approval-policy";
import {mailSchema} from "./mail-policy";

function fixture(){
 const mail=mailSchema.parse({id:randomUUID(),direction:"inbound",from:FINANCE_OWNER,message_id:"<verified@example.test>",subject:"P&L",text:"Show November P&L; copy client@example.test",reply_to:[]});
 const received={id:mail.id,from:FINANCE_OWNER,message_id:mail.message_id,subject:mail.subject,text:mail.text,authentication:{dkim:"pass",dmarc:"pass"},headers:{"Auto-Submitted":"no"}};
 const job={id:randomUUID(),email_id:mail.id,thread_id:randomUUID(),sender:FINANCE_OWNER,response_text:"Verified report",attachments:[]};
 return {mail,received,job};
}
test("only the authenticated owner may approve client mail and Amgad corrections",()=>{
 assert.equal(isFinanceOwner(FINANCE_OWNER),true);
 for(const email of [null,undefined,"mmahmoud@thinkwaymedia.com","raaof@thinkwaymedia.com","Owner <"+FINANCE_OWNER+">",FINANCE_OWNER+".evil.test"])assert.equal(isFinanceOwner(email),false);
});
test("verified owner reply ignores copied recipients and body instructions",()=>{
 const f=fixture(); const payload=automaticReplyPayload(f.job,f.mail,f.received);
 assert.deepEqual(payload.cc,[]);assert.deepEqual(payload.bcc,[]);assert.equal(payload.reply_all,false);
 assert.equal(payload.headers["Auto-Submitted"],"auto-replied");
 assert.throws(()=>automaticReplyPayload({...f.job,sender:"mmahmoud@thinkwaymedia.com"},f.mail,f.received));
 assert.throws(()=>automaticReplyPayload(f.job,{...f.mail,reply_to:["client@example.test"]},f.received));
});
test("provider evidence must authenticate and bind the actual request, never sender-supplied headers",()=>{
 const {mail,received}=fixture();assert.equal(verifyAutomaticRequest(mail,received),FINANCE_OWNER);
 for(const r of [null,{}, {...received,authentication:null}, {...received,authentication:{dkim:"pass",dmarc:"fail"}}, {...received,authentication:{dkim:"unknown",dmarc:"pass"}}, {...received,id:randomUUID()}, {...received,text:"different request"}, {...received,message_id:"<other>"}, {...received,from:"outsider@example.test"}, {...received,headers:{"Auto-Submitted":"auto-replied"}}, {...received,headers:{"List-ID":"newsletter"}}])assert.throws(()=>verifyAutomaticRequest(mail,r));
 assert.throws(()=>verifyAutomaticRequest(mail,{...received,authentication:null,headers:{"Authentication-Results":"dkim=pass; dmarc=pass"}}));
 for(const sender of ["mmahmoud@thinkwaymedia.com","raaof@thinkwaymedia.com"])assert.throws(()=>verifyAutomaticRequest({...mail,from:sender},{...received,from:sender}));
});
function harness(){
 const f=fixture();const events:string[]=[];const keys:string[]=[];
 const deps={environment:"production",enabled:"true",claim:async()=>{events.push("claim");return f.job;},load:async()=>{events.push("load");return f;},hold:async()=>{events.push("hold");},send:async(_job:unknown,_payload:unknown,key:string)=>{events.push("send");keys.push(key);return "receipt";},finish:async()=>{events.push("finish");},pending:async()=>{events.push("pending");}};
 return {f,events,keys,deps};
}
test("dev and disabled delivery do not claim or call the provider",async()=>{
 for(const environment of [undefined,"preview","development"]){const h=harness();assert.deepEqual(await deliverAutomaticReply({...h.deps,environment}),{sent:0});assert.deepEqual(h.events,[]);}
 const h=harness();await deliverAutomaticReply({...h.deps,enabled:"false"});assert.deepEqual(h.events,[]);
});
test("valid automatic delivery persists receipt and uses a job-stable idempotency key",async()=>{
 const h=harness();assert.deepEqual(await deliverAutomaticReply(h.deps),{sent:1});assert.deepEqual(h.events,["claim","load","send","finish"]);assert.deepEqual(h.keys,[`amgad-auto-${h.f.job.id}`]);
});
test("missing authentication or changed recipient holds the job without sending",async()=>{
 const h=harness();assert.deepEqual(await deliverAutomaticReply({...h.deps,load:async()=>({...h.f,received:null})}),{sent:0,review:true});assert.deepEqual(h.events,["claim","hold"]);
});
test("uncertain send or receipt persistence preserves the retry key and never reports sent",async()=>{
 for(const failAt of ["send","finish"]){const h=harness();const deps={...h.deps,[failAt]:async()=>{throw Error("timeout");}};
  assert.deepEqual(await deliverAutomaticReply(deps),{sent:0,pending:true});assert.equal(h.events.at(-1),"pending");
  await deliverAutomaticReply(h.deps);assert.equal(h.keys.at(-1),`amgad-auto-${h.f.job.id}`);
 }
});
test("temporary provider load failure retries instead of permanently holding the owner request",async()=>{
 const h=harness();
 assert.deepEqual(await deliverAutomaticReply({...h.deps,load:async()=>{throw Error("provider 503");}}),{sent:0,pending:true});
 assert.deepEqual(h.events,["claim","pending"]);
 await deliverAutomaticReply(h.deps);
 assert.equal(h.keys[0],`amgad-auto-${h.f.job.id}`);
});
