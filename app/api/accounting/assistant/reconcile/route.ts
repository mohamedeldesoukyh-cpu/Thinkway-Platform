import { z } from "zod";
import { accountingContext,loadAccountingSetup } from "@/features/accounting/setup-server";
import { reconciliationSchema,reconcileStatement } from "@/features/finance-assistant/reconciliation";
import { readLedgerDetails } from "@/features/finance-assistant/ledger-details";
import { financeReportPdf } from "@/features/finance-assistant/report-pdf";
import { assertCsrfRequest } from "@/lib/security/csrf";
import { consumeRateLimit } from "@/lib/security/rate-limit";
export const runtime="nodejs";
export const maxDuration=120;
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(request:Request){
 if(!assertCsrfRequest(request).ok)return json({error:"Invalid origin"},403);
 let ctx;try{ctx=await accountingContext();}catch{return json({error:"Accounting access required"},403);}
 if(!consumeRateLimit({category:"ai",identity:`finance-reconcile:${ctx.user.id}`}).allowed)return json({error:"Please wait before reconciling again."},429);
 try{
  const input=reconciliationSchema.parse(await request.json());
  const setup=await loadAccountingSetup(input.companyId);
  if(!setup.company||input.yearId&&!setup.years.some(y=>y.id===input.yearId))throw Error("Invalid company or fiscal year.");
  if(!setup.accounts.some(a=>a.code===input.account))throw Error("Choose an existing six-digit ledger account.");
  let party:string|null=null;
  if(input.clientName){
    const lookup=await ctx.db.rpc("tw_accounting_party_lookup",{p_company:input.companyId,p_kind:"client",p_search:input.clientName,p_selected:null});
    if(lookup.error)throw Error("Client lookup failed.");
    const matches=z.array(z.object({id:z.string().uuid()})).parse(lookup.data);
    if(matches.length!==1)throw Error("Specify a unique client name.");party=matches[0].id;
  }
  const args={p_company:input.companyId,p_from:input.from,p_to:input.to,p_account:input.account,p_kind:party?"client":"all",p_party:party,p_currency:input.currency,p_offset:0,p_auxiliary:null,p_options:{display:"foreign",reportMode:"statement",dateBasis:"journal",includeUnlocked:true,excludeClosing:false,skipZero:false}};
  const result=await ctx.db.rpc("tw_finance_statement_snapshot",args);
  if(result.error)throw Error("Ledger unavailable.");
  const report=z.object({accounts:z.array(z.object({account:z.string(),currency:z.string(),opening:z.string(),closing:z.string()}))}).parse(result.data);
  const accounts=report.accounts.filter(a=>a.account===input.account&&a.currency===input.currency);
  if(accounts.length>1)throw Error("Ambiguous ledger balance.");
  const evidence=reconcileStatement(input,await readLedgerDetails(ctx.db,args,result.data),accounts[0]?.opening??"0.00",accounts[0]?.closing??"0.00");
  const retrievedAt=new Date().toISOString();
  if(input.pdf)return new Response(new Uint8Array(await financeReportPdf(evidence,retrievedAt)),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="Amgad-reconciliation.pdf"',"Cache-Control":"private, no-store"}});
  return json({content:"Reconciliation prepared. Review the balance controls and every unmatched or ambiguous entry. No accounting records were changed.",sources:[evidence],retrievedAt});
 }catch(e){return json({error:e instanceof Error?e.message:"Reconciliation failed."},400);}
}
