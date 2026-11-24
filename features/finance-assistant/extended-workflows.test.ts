import test from "node:test";
import assert from "node:assert/strict";
import {compareProfitReports} from "./comparison";
import {reconciliationSchema,reconcileStatement} from "./reconciliation";
import {recipientsSchema,signComposedMail,verifyComposedMail,type ComposedMail} from "./compose-policy";
import type {LedgerRow} from "./ledger-details";
import type {FinanceEvidence} from "./contracts";
import {financePlanSchema} from "./contracts";
import {runFinanceAssistant} from "./assistant";
import {documentInput,extractedStatementSchema,statementCsv} from "./document-extraction";
const id="11111111-1111-4111-8111-111111111111";
const base={companyId:id,yearId:null,account:"121001",currency:"EGP",from:"2026-11-01",to:"2026-11-30",opening:"0",closing:"100",direction:"same" as const,pdf:false,csv:"date,reference,description,amount\n2026-11-01,INV1,Invoice,100"};
const line:LedgerRow={id,line:1,account:"121001",name:"Receivables",date:"2026-11-01",number:"JV1",reference:"INV1",description:"Invoice",party:"Client",report_currency:"EGP",debit:"100",credit:"0",balance:"100"};
test("zero comparison balances cannot become claims of no ledger activity",async()=>{
 let calls=0;
 const reply=await runFinanceAssistant({companyId:id,yearId:null,message:"Compare periods",history:[]},{provider:{identity:{id:"fixture",name:"Fixture"},complete:async()=>{calls++;return {providerId:"fixture",model:"fixture",content:JSON.stringify({action:"pnl_comparison",from:"2026-11-01",to:"2026-11-30",comparisonFrom:"2026-10-01",comparisonTo:"2026-10-31",display:"local"})};}},execute:async()=>({title:"Comparison",href:"/",scope:"Selected periods",facts:{},tables:[{heading:"EGP",columns:[],rows:[["","Net profit","Total","0.00","0.00","0.00","N/A"]]}]})});
 assert.equal(calls,1);assert.match(reply.content,/does not establish/);
});
test("document extraction checks file signatures and keeps source rows in CSV",()=>{
 assert.throws(()=>documentInput(Buffer.from("not pdf"),"application/pdf"));
 assert.throws(()=>documentInput(Buffer.from("<script>"),"image/png"));
 assert.equal(documentInput(Buffer.from("%PDF-1.4"),"application/pdf").type,"input_file");
 const data=extractedStatementSchema.parse({currency:"EGP",from:base.from,to:base.to,opening:"0",closing:"100",complete:true,warnings:[],rows:[{date:"2026-11-01",reference:'INV"1',description:"عميل, invoice",amount:"100",source:"Page 1, row 1"}]});
 assert.match(statementCsv(data),/"INV""1"/);assert.equal(extractedStatementSchema.safeParse({...data,currency:"unknown"}).success,false);
});
test("reconciliation checks signs, balances and scope without mutating records",()=>{
 const report=reconcileStatement(base,[line],"0","100");assert.equal(report.facts.matched,1);assert.equal(report.facts.closingDifference,"0.00");assert.equal(report.facts.executed,false);
 assert.throws(()=>reconcileStatement({...base,closing:"99"},[line],"0","100"),/opening plus/);
 assert.throws(()=>reconcileStatement(base,[{...line,report_currency:"USD"}],"0","100"),/scope/);
 assert.throws(()=>reconcileStatement({...base,from:"2026-11-02"},[line],"0","100"),/outside/);
 const opposite=reconcileStatement({...base,direction:"opposite"},[{...line,debit:"0",credit:"100"}],"0","-100");assert.equal(opposite.facts.matched,1);
});
test("duplicate candidates, duplicate statement entries and missing references never auto-match",()=>{
 assert.equal(reconcileStatement(base,[line,{...line,line:2}],"0","200").facts.ambiguous,1);
 assert.equal(reconcileStatement({...base,closing:"200",csv:base.csv+"\n2026-11-01,INV1,Invoice,100"},[line],"0","100").facts.matched,0);
 assert.equal(reconcileStatement({...base,csv:base.csv.replace("INV1","")},[{...line,reference:""}],"0","100").facts.matched,0);
 assert.equal(reconcileStatement(base,[{...line,date:"2026-11-02"}],"0","100").facts.unmatched,1);
 assert.equal(reconciliationSchema.safeParse({...base,account:"121"}).success,false);
});
test("comparison aligns accounts, separates currencies and avoids zero-base growth",()=>{
 const evidence=(tables:NonNullable<FinanceEvidence['tables']>):FinanceEvidence=>({title:"P&L",href:"/",scope:"",facts:{},tables});
 const previous=evidence([{heading:"EGP",columns:[],rows:[["4","Revenue","Revenue","1,000.00"],["6","Expense","Expense","-100.00"]]}]);
 const current=evidence([{heading:"EGP",columns:[],rows:[["6","Expense","Expense","-200.00"],["4","Revenue","Revenue","1,250.00"],["7","New","Revenue","1.00"]]},{heading:"USD",columns:[],rows:[["4","Revenue","Revenue","20.00"]]}]);
 const result=compareProfitReports(current,previous);assert.equal(result.length,2);
 assert.deepEqual(result[0].rows.find(r=>r[0]==="4")?.slice(3),["1250.00","1000.00","250.00","25.00%"]);
 assert.equal(result[0].rows.find(r=>r[0]==="6")?.at(-1),"N/A");assert.equal(result[1].rows[0].at(-1),"N/A");
 assert.equal(financePlanSchema.safeParse({action:"pnl_comparison",from:"2026-11-01",to:"2026-11-30",comparisonFrom:"2026-10-31",comparisonTo:"2026-10-01",display:"local"}).success,false);
});
test("email approval binds exact To/CC, contents, PDF, user and expiry",()=>{
 const mail:ComposedMail={userId:id,companyId:id,recipients:{to:["client@example.com"],cc:["copy@example.com"]},subject:"Statement",text:"Reviewed",attachments:[{filename:"Amgad-accounting-report.pdf",content:"YQ==",content_type:"application/pdf"}],expires:Date.now()+600000,nonce:id};
 const token=signComposedMail(mail,"secret");assert.deepEqual(verifyComposedMail(token,"secret",id),mail);
 assert.throws(()=>verifyComposedMail(token,"wrong",id));assert.throws(()=>verifyComposedMail(token,"secret",id,mail.expires));
 const changed=Buffer.from(JSON.stringify({...mail,recipients:{to:["attacker@example.com"],cc:[]}})).toString("base64url");assert.throws(()=>verifyComposedMail(changed+"."+token.split(".")[1],"secret",id));
 assert.equal(recipientsSchema.safeParse({to:["client@example.com"],cc:["CLIENT@example.com"]}).success,false);
});
