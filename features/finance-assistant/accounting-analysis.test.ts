import assert from "node:assert/strict";
import test from "node:test";
import {CHART} from "@/features/accounting/chart";
import type {AccountingSetup} from "@/features/accounting/setup-types";
import {aggregateAccountingRows,accountingAnalysis} from "./accounting-analysis";
import {financePlanSchema} from "./contracts";
import {executeFinanceReport} from "./report-tools";
import {financeEmailHtml,financeEmailText} from "./mail-policy";
const setup={company:{id:"11111111-1111-4111-8111-111111111111",name:"Fixture",base_currency:"EGP"},years:[{id:"year",start_date:"2026-01-01",end_date:"2026-12-31"}],accounts:CHART} as AccountingSetup;
const plan={action:"accounting_analysis" as const,title:"Client profitability",from:"2026-01-01",to:"2026-12-31",display:"local" as const,area:"profitability" as const,groupBy:["client"] as ["client"],measures:["revenue","cost","gross_profit","margin"] as ["revenue","cost","gross_profit","margin"],accounts:[],clientName:null,includeTransactions:false};
const row=(account:string,debit:string,credit:string,overrides={})=>({id:"journal",line:1,date:"2026-01-01",account,name:"Account",number:"JV1",reference:"",description:"",party:"CLT-000001",report_currency:"EGP",debit,credit,balance:"0",transaction_type:"invoice",client_id:"client1",client_code:"CLT-000001",client_name:"Client",vendor_id:null,vendor_name:null,campaign_id:null,campaign_name:null,attribution:"linked source",...overrides});
test("client GP retains reversals, unmatched cost and zero revenue without mixing currencies",()=>{
 const result=aggregateAccountingRows([row("411001","0","1000"),row("511001","600","0"),row("411001","100","0"),row("511001","0","50"),row("511001","40","0",{client_id:null,client_name:null}),row("411001","0","10",{report_currency:"USD"}),row("411001","999","0",{transaction_type:"closing"})],setup,plan);
 assert.deepEqual(result.totals,[{currency:"EGP",revenue:"900.00",cost:"590.00",grossProfit:"310.00",count:5},{currency:"USD",revenue:"10.00",cost:"0.00",grossProfit:"10.00",count:1}]);
 assert.equal(result.unassigned,1);assert.deepEqual(result.tables[0].rows[0],["1 · Client","900.00","550.00","350.00","38.89"]);
 assert.deepEqual(result.tables[0].rows[1],["Unassigned client","0.00","40.00","-40.00","—"]);
});
test("custom month/account grouping keeps identities distinct and applies scope",()=>{
 const result=aggregateAccountingRows([row("411001","0","10"),row("411001","0","20",{client_id:"client2"}),row("112001","30","0")],setup,{...plan,groupBy:["client","month"],measures:["revenue"]});
 assert.equal(result.tables[0].rows.length,3);assert.equal(result.totals[0].revenue,"30.00");
});
test("analysis rejects mutation fields and unvalidated measures",()=>{
 assert.equal(financePlanSchema.safeParse({...plan,sql:"select secret"}).success,false);
 assert.equal(financePlanSchema.safeParse({...plan,measures:["forecast"]}).success,false);
 assert.equal(financePlanSchema.safeParse({...plan,from:"2026-02-30"}).success,false);
});
test("analysis fails on duplicate entries and ambiguous client never retrieves ledger",async()=>{
 await assert.rejects(accountingAnalysis({rpc:async()=>({data:{count:2,rows:[row("411001","0","10"),row("411001","0","10")]},error:null})},setup,plan,null),/Incomplete/);
 let calls=0;const evidence=await accountingAnalysis({rpc:async()=>{calls++;return {data:[],error:null};}},setup,{...plan,clientName:"Unknown"},null);
 assert.equal(calls,1);assert.equal(evidence.title,"Client selection");
});
test("financial position requests complete controls without detail row limits",async()=>{
 let options:unknown;const e=await executeFinanceReport({rpc:async(_n,args)=>{options=args.p_options;return {data:{currency:"EGP",accounts:[]},error:null};}},setup,"year",{action:"financial_position",mode:"trial",display:"local",from:null,to:null,byAccount:true});
 assert.equal((options as {summaryOnly:boolean}).summaryOnly,true);assert.equal(e.title,"Trial Balance");
});
test("supplier unsettled requests use vendor directory and vendor open items",async()=>{
 const calls:Record<string,unknown>[]=[];await executeFinanceReport({rpc:async(_n,args)=>{calls.push(args);return {data:calls.length===1?[{id:setup.company!.id,name:"Supplier"}]:[],error:null};}},setup,"year",{action:"supplier_outstanding",clientName:"Supplier",currency:"EGP",from:null,to:null});
 assert.equal(calls[0].p_kind,"vendor");assert.equal(calls[1].p_kind,"vendor");
});
test("profitability email contains native escaped table and mandatory allocation qualification",()=>{
 const text=financeEmailText({content:"Your report is ready.",retrievedAt:"2026-11-24",sources:[{title:"Profit",scope:"",href:"/accounting",reportPlan:plan,facts:{provisional:true},tables:[{heading:"EGP",columns:["Client","Revenue","Cost","GP"],rows:[["<client>","100.00","60.00","40.00"]]}]}]},{pdfAttached:true,language:"en"});
 const html=financeEmailHtml(text);assert.match(html,/&lt;client&gt;/);assert.match(html,/<th/);assert.match(html,/profit is provisional/);assert.doesNotMatch(html,/<img|background:/);
});
test("Arabic analysis emails localize headings without bilingual boilerplate",()=>{
 const text=financeEmailText({content:"التقرير جاهز.",retrievedAt:"2026-11-24",sources:[{title:"Profit",scope:"",href:"/accounting",reportPlan:plan,facts:{},tables:[{heading:"Client profitability · EGP",columns:["Client","Revenue","Direct cost","Gross profit"],rows:[["Client name","100.00","60.00","40.00"]]}]}]},{pdfAttached:true,language:"ar"});
 assert.match(text,/الإيرادات/);assert.match(text,/مجمل الربح/);assert.doesNotMatch(text,/Client profitability|Direct cost|Gross profit|report PDF is attached/);
});
