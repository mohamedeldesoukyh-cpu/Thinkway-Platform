import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mediaAccountingReview } from "./media-review";
import { financePlanSchema } from "./contracts";
const row={id:randomUUID(),type:"client_invoice",number:"INV-1",date:"2026-11-01",party:"Client",currency:"USD",net:"100.00",tax:"14.00",total:"114.00",eligible:true,reason:"",status:"unposted",token:"a".repeat(32),rate:"50.00",base:"EGP",accruals:[]};
test("posting differences preserve evidence and propose only eligible operational fixes",async()=>{
 const calls:Array<{name:string;args:Record<string,unknown>}>=[];
 const evidence=await mediaAccountingReview({rpc:async(name,args)=>{calls.push({name,args});return {data:{rows:[row,{...row,id:randomUUID(),eligible:false,reason:"Finalize invoice"}],count:2},error:null};}},"company","Thinkway","2026-11-01","2026-11-30","client_invoice");
 assert.equal(calls[0].name,"tw_accounting_media_queue");assert.equal(calls[0].args.p_posted,false);
 assert.equal(evidence.corrections?.length,1);assert.equal(evidence.corrections?.[0].token,row.token);
 assert.match(evidence.corrections![0].summary,/114.00 USD/);assert.match(evidence.scope,/not a full reconciliation/);
 assert.match(JSON.stringify(evidence.tables),/Finalize invoice/);
 assert.equal(calls.some(c=>c.name.includes("post")&&!c.name.includes("queue")),false);
});
test("posting review rejects inaccessible, oversized and changing pages",async()=>{
 for(const count of [2,501])await assert.rejects(mediaAccountingReview({rpc:async()=>({data:{rows:[row],count},error:null})},"c","C","2026-01-01","2026-12-31","client_invoice"));
 let n=0;
 await assert.rejects(mediaAccountingReview({rpc:async()=>({data:n++?{rows:[row],count:52}:{rows:Array.from({length:50},()=>({...row,id:randomUUID()})),count:51},error:null})},"c","C","2026-01-01","2026-12-31","client_invoice"),/changed/);
});
test("empty posting queue does not certify matching Media and Accounting balances",async()=>{
 const evidence=await mediaAccountingReview({rpc:async()=>({data:{rows:[],count:0},error:null})},"c","C","2026-01-01","2026-12-31","all");
 assert.match(String(evidence.facts.noDifferences),/other differences have not been tested/);
 assert.deepEqual(evidence.corrections,[]);
});
test("natural language planning cannot authorize writes or introduce SQL",()=>{
 assert.equal(financePlanSchema.safeParse({action:"media_accounting_review",from:null,to:null,documentType:"all"}).success,true);
 for(const extra of [{approved:true},{sql:"delete from invoices"},{operation:"post"}])assert.equal(financePlanSchema.safeParse({action:"media_accounting_review",from:null,to:null,documentType:"all",...extra}).success,false);
});
