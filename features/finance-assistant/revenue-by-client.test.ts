import assert from "node:assert/strict";
import test from "node:test";
import type { AccountingSetup } from "@/features/accounting/setup-types";
import { executeFinanceReport } from "./report-tools";
import { groupClientRevenue } from "./revenue-by-client";
import type { LedgerRow } from "./ledger-details";

const company="11111111-1111-4111-8111-111111111111";
const setup={company:{id:company,name:"Fixture",base_currency:"EGP"},years:[],accounts:[{code:"410000",type:"Revenue",kind:"Group"}]} as unknown as AccountingSetup;
const plan={action:"revenue_by_client" as const,from:"2026-11-01",to:"2026-11-30",display:"local" as const,includeTransactions:false};
const row=(line:number,party:string|null,credit:string,debit="0.00",extra:Partial<LedgerRow>={}):LedgerRow=>({id:company,line,party,credit,debit,report_currency:"EGP",transaction_type:"journal",account:"411001",name:"Revenue",date:"2026-11-01",number:"JV1",reference:"",description:"Fixture",balance:"0.00",...extra});

test("client aggregation retains offsetting, negative and unassigned activity and separates currencies",()=>{
 const result=groupClientRevenue([row(1,"A","10.01"),row(2,"A","0","10.01"),row(3,"B","0","2.03"),row(4,null,"3.02"),row(5,"A","999", "0",{transaction_type:"closing"}),row(6,"A","7.00","0",{report_currency:"USD"})],new Map([["A","Known client"]]));
 assert.equal(result.length,2);assert.equal(result[0].total,99n);assert.equal(result[1].total,700n);
 assert.equal(result[0].groups.find(g=>g.code==="A")?.count,2);
 assert.equal(result[0].groups.find(g=>g.code==="A")?.name,"Known client");
 assert.equal(result[0].groups.find(g=>!g.code)?.name,"Unassigned client");
 assert.match(result[0].groups.find(g=>g.code==="B")!.name,/Name unavailable/);
 assert.throws(()=>groupClientRevenue([row(1,"A","1","0",{transaction_type:undefined})],new Map()),/classification unavailable/);
});

test("200 source entries become named client totals and total row, with detail only on explicit request",async()=>{
 const rows=Array.from({length:200},(_,i)=>row(i+1,i<100?"CLT-1":"CLT-2",i%2?"0":"10.01",i%2?"0.01":"0"));
 const calls:{name:string;args:Record<string,unknown>}[]=[];
 const db={rpc:async(name:string,args:Record<string,unknown>)=>{
  calls.push({name,args});
  return {error:null,data:name==="tw_finance_statement_snapshot"?{count:200,rows,accounts:[{currency:"EGP",credit:"1001.00",debit:"1.00"}]}:[{id:"exact",code:args.p_search,name:args.p_search==="CLT-1"?"Mind Share":"Fresh"},{id:"wrong",code:"CLT-10",name:"Wrong partial match"}]};
 }};
 const evidence=await executeFinanceReport(db,setup,null,plan);
 assert.equal(calls[0].args.p_account,"410000");assert.equal(calls[0].args.p_company,company);
 assert.equal(evidence.tables?.length,1);assert.equal(evidence.tables?.[0].orientation,"portrait");
 assert.deepEqual(evidence.tables?.[0].rows,[["CLT-1","Mind Share","500.00"],["CLT-2","Fresh","500.00"],["","Total","1000.00"]]);
 assert.equal(evidence.facts.ledgerReconciled,true);assert.equal(evidence.facts.transactionCount,200);
 const detailed=await executeFinanceReport(db,setup,null,{...plan,includeTransactions:true});
 assert.equal(detailed.tables?.length,2);assert.equal(detailed.tables?.[1].rows.length,200);
});

test("mismatched snapshot totals fail closed and never produce a misleading summary",async()=>{
 const db={rpc:async()=>({error:null,data:{count:1,rows:[row(1,"A","10")],accounts:[{currency:"EGP",credit:"20",debit:"0"}]}})};
 await assert.rejects(executeFinanceReport(db,setup,null,plan),/do not reconcile/);
});

test("closing entries are removed after snapshot reconciliation, not mistaken for revenue",async()=>{
 const db={rpc:async(name:string)=>({error:null,data:name==="tw_finance_statement_snapshot"?{count:2,rows:[row(1,"A","10.00"),row(2,"A","0","10.00",{transaction_type:"closing"})],accounts:[{currency:"EGP",credit:"10",debit:"10"}]}:[{id:"a",code:"A",name:"Client A"}]})};
 const result=await executeFinanceReport(db,setup,null,plan);
 assert.deepEqual(result.facts.totals,[{currency:"EGP",netRevenue:"10.00"}]);assert.equal(result.facts.transactionCount,1);
});
