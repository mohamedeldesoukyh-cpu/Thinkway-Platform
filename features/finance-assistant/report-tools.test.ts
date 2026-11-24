import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AccountingSetup } from "@/features/accounting/setup-types";
import { executeFinanceReport } from "./report-tools";

const companyId = "11111111-1111-4111-8111-111111111111";
const yearId = "22222222-2222-4222-8222-222222222222";
const setup = {company:{id:companyId,name:"Fixture company",base_currency:"EGP"},years:[{id:yearId,start_date:"2026-01-01",end_date:"2026-12-31"}],accounts:[{code:"400001",name:"Revenue",type:"Revenue"},{code:"600001",name:"Expense",type:"Expense"}]} as AccountingSetup;
function database(results: unknown[], calls: {name:string;args:Record<string,unknown>}[]) {
  return {rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:results.shift(),error:null};}} as unknown as SupabaseClient;
}
test("P&L uses the accounting RPC, selected company, fiscal dates and exact money totals",async()=>{
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const evidence=await executeFinanceReport(database([{currency:"EGP",accounts:[
    {account:"400001",name:"Revenue",currency:"EGP",opening:"0",debit:"0",credit:"1200",closing:"-1200"},
    {account:"600001",name:"Expense",currency:"EGP",opening:"0",debit:"700",credit:"0",closing:"700"},
  ]}],calls),setup,yearId,{action:"pnl",from:null,to:null,display:"local"});
  assert.equal(calls.length,1);assert.equal(calls[0].name,"tw_accounting_statement_filtered");
  assert.equal(calls[0].args.p_company,companyId);assert.equal(calls[0].args.p_from,"2026-01-01");
  assert.equal((calls[0].args.p_options as {excludeClosing:boolean}).excludeClosing,true);
  assert.match(JSON.stringify(evidence.facts),/500.00/);
});
test("ambiguous clients never cause a ledger read",async()=>{
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const evidence=await executeFinanceReport(database([[{id:companyId,name:"Same"},{id:yearId,name:"Same"}]],calls),setup,yearId,
    {action:"client_statement",clientName:"Same",from:null,to:null,display:"local"});
  assert.equal(calls.length,1);assert.match(evidence.scope,/Choose a client/);
});
test("client statement keeps posted opening and closing balances separate by currency",async()=>{
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  const evidence=await executeFinanceReport(database([[{id:companyId,name:"Client",code:"CL1"}],{currency:"FC",count:0,rows:[],accounts:[
    {account:"121001",name:"Receivable",currency:"USD",opening:"100",debit:"50",credit:"20",closing:"130"},
    {account:"121001",name:"Receivable",currency:"EGP",opening:"2000",debit:"0",credit:"500",closing:"1500"},
  ]}],calls),setup,yearId,{action:"client_statement",clientName:"Client",from:null,to:null,display:"foreign"});
  assert.equal(calls[1].args.p_party,companyId);
  const groups=evidence.facts.groups as {currency:string;totals:{closing:string}}[];
  assert.equal(groups.find(g=>g.currency==="USD")?.totals.closing,"130.00");
  assert.equal(groups.find(g=>g.currency==="EGP")?.totals.closing,"1500.00");
});
test("missing fiscal scope fails before report access",async()=>{
  const calls: {name:string;args:Record<string,unknown>}[]=[];
  await assert.rejects(executeFinanceReport(database([],calls),setup,null,{action:"pnl",from:null,to:null,display:"local"}),/fiscal year/);
  assert.equal(calls.length,0);
});
