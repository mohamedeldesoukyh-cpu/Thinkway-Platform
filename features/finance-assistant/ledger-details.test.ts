import test from "node:test";
import assert from "node:assert/strict";
import { readLedgerDetails } from "./ledger-details";
import { financePlanSchema } from "./contracts";
const row=(line:number)=>({id:"journal",line,account:"121001",name:"Receivables",date:"2026-11-01",number:"JV-1",reference:null,description:"Entry",party:null,report_currency:"USD",debit:"90071992547409.91",credit:"0.00",balance:"90071992547409.91"});
test("detailed statements retrieve every page without rounding monetary strings",async()=>{
 const calls:Record<string,unknown>[]=[];
 const rows=await readLedgerDetails({rpc:async(_name,args)=>{calls.push(args);return {data:{count:101,rows:[row(101)]},error:null};}},{p_company:"company",p_party:"client"},{count:101,rows:Array.from({length:100},(_,i)=>row(i+1))});
 assert.equal(rows.length,101);assert.equal(rows[100].debit,"90071992547409.91");assert.equal(calls[0].p_offset,100);assert.equal(calls[0].p_party,"client");
});
test("partial, duplicate and oversized statements never masquerade as complete SOAs",async()=>{
 const db={rpc:async()=>({data:null,error:"not expected"})};
 for(const data of [{count:2,rows:[row(1)]},{count:2,rows:[row(1),row(1)]},{count:1001,rows:[]}])await assert.rejects(readLedgerDetails(db,{},data));
});
test("custom reports accept only approved fields and account-code filters",()=>{
 const plan={action:"custom_ledger",title:"Receivable entries",from:null,to:null,display:"foreign",accounts:["121"],columns:["date","debit","credit"]};
 assert.equal(financePlanSchema.safeParse(plan).success,true);
 assert.equal(financePlanSchema.safeParse({...plan,columns:["password","debit"]}).success,false);
 assert.equal(financePlanSchema.safeParse({...plan,accounts:["121; DELETE"]}).success,false);
});
