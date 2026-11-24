import {statementDocument} from '@/features/accounting/statement-document';
// Credential-free adapter: its caller supplies the authenticated, RLS-scoped client.
import { z } from "zod";
import { financialReportSections } from "@/features/accounting/financial-report-options-model";
import { statementGroups, type Statement } from "@/features/accounting/statement-model";
import type { AccountingSetup } from "@/features/accounting/setup-types";
import type { FinanceEvidence, FinancePlan } from "./contracts";
import { mediaAccountingReview } from "./media-review";
import { readLedgerDetails } from "./ledger-details";
import { compareProfitReports } from "./comparison";
import { cents, decimal } from "@/features/accounting/journal-model";
import { partyCode } from "@/features/accounting/party-code";
import { revenueByClient } from "./revenue-by-client";

const amount = z.string().regex(/^-?\d+(\.\d+)?$/);
const accountSchema = z.object({account:z.string(),name:z.string(),currency:z.string(),opening:amount,debit:amount,credit:amount,closing:amount});
const reportSchema = z.object({currency:z.string(),accounts:z.array(accountSchema),count:z.number().optional(),party:z.object({code:z.string().nullable().optional(),address:z.string().nullable().optional(),taxId:z.string().nullable().optional()}).nullable().optional(),aging:z.array(z.object({account:z.string(),currency:z.string(),normal_balance:z.string(),buckets:z.array(amount),unapplied:amount})).optional()});
const partySchema = z.array(z.object({id:z.string().uuid(),name:z.string(),code:z.string().nullable().optional()}));
export type FinanceReportClient = {rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:unknown}>};

export async function executeFinanceReport(
  db: FinanceReportClient, setup: AccountingSetup, yearId: string | null,
  plan: Exclude<FinancePlan, { action: "reply" }>,
): Promise<FinanceEvidence> {
  const company = setup.company;
  if (!company) throw new Error("Select an accounting company.");
  if (plan.action === "pnl_comparison") {
    const current = await executeFinanceReport(db,setup,yearId,{action:"pnl",from:plan.from,to:plan.to,display:plan.display});
    const previous = await executeFinanceReport(db,setup,yearId,{action:"pnl",from:plan.comparisonFrom,to:plan.comparisonTo,display:plan.display});
    const tables = compareProfitReports(current,previous);
    return {title:"P&L comparison",href:current.href,reportPlan:plan,tables,
      scope:`${current.scope} Comparison: ${plan.comparisonFrom} to ${plan.comparisonTo}. Change = current minus comparison; signed expenses reduce profit. Percentages use positive comparison balances only and truncate to two decimals. Periods may differ in length. Figures show variance, not its underlying business cause. Reports are retrieved sequentially; rerun after postings change.`,
      facts:{company:company.name,currentFrom:plan.from,currentTo:plan.to,comparisonFrom:plan.comparisonFrom,comparisonTo:plan.comparisonTo,tables}};
  }
  const year = setup.years.find(y => y.id === yearId);
  if (plan.action !== "client_outstanding" && (!plan.from || !plan.to) && !year) throw new Error("Select a fiscal year or specify both dates.");
  const from = plan.from ?? year?.start_date ?? "", to = plan.to ?? year?.end_date ?? "";
  if (from > to) throw new Error("Invalid reporting period.");
  if (plan.action === "revenue_by_client") return revenueByClient(db,setup,{...plan,from,to},yearId);
  if (plan.action === "media_accounting_review") return {...await mediaAccountingReview(db,company.id,company.name,from,to,plan.documentType),reportPlan:{...plan,from,to}};
  let partyId: string | null = null;
  let partyName: string | null = null;
  if (plan.action === "client_statement" || plan.action === "client_outstanding") {
    const found = await db.rpc("tw_accounting_party_lookup", {p_company:company.id,p_kind:"client",p_search:plan.clientName,p_selected:null});
    if (found.error) throw new Error("Client lookup unavailable.");
    const candidates = partySchema.parse(found.data);
    if (candidates.length !== 1) return {
      title:"Client selection",href:`/accounting?company=${company.id}#client-statements`,
      scope:candidates.length ? "Choose a client before retrieving a statement." : "No matching client found in the accounting directory.",
      facts:{candidates:candidates.slice(0,10).map(({name,code})=>({name,code})),moreMatches:candidates.length>10},
    };
    partyId = candidates[0].id; partyName = candidates[0].name;
  }
  if (plan.action === "client_outstanding") {
    const result=await db.rpc("tw_accounting_open_items",{p_company:company.id,p_kind:"client",p_party:partyId,p_currency:plan.currency,p_account:null});
    if(result.error)throw Error("Outstanding items unavailable.");
    const items=z.array(z.object({id:z.string(),number:z.string(),date:z.string(),due:z.string().nullable(),total:amount,settled:amount,adjustments:amount.optional(),outstanding:amount,currency:z.string(),account:z.string()})).max(1000).parse(result.data);
    if(items.some(i=>i.currency!==plan.currency))throw Error("Unexpected item currency.");
    const total=decimal(items.reduce((sum,i)=>sum+cents(i.outstanding),BigInt(0)));
    return {title:`${partyName} — unsettled statement`,href:`/accounting?company=${company.id}#client-statements`,reportPlan:plan,
      scope:`${company.name} · ${plan.currency} · Current open invoices and applied settlements at retrieval time, across fiscal years. This is not a historical balance or the complete ledger SOA; unallocated receipts and manual ledger entries may differ. No payment demand was sent.`,
      tables:[{heading:`${partyName} · ${plan.currency}`,columns:["Document","Date","Due","Account","Total","Settled","Adjustments","Outstanding"],rows:[...items.map(i=>[i.number,i.date,i.due??"Not specified",i.account,i.total,i.settled,i.adjustments??"0.00",i.outstanding]),["Total outstanding","","","","","","",total]]}],
      facts:{company:company.name,client:partyName,currency:plan.currency,count:items.length,outstanding:total,currentOnly:true}};
  }
  const options = {includeAuxiliary:false,includeThirdParties:false,reportMode:plan.action === "pnl" ? "profit" : "statement",
    dateBasis:"journal",excludeClosing:plan.action === "pnl",display:plan.display,accountStatus:"all",types:[],includeUnlocked:true,
    excludeReversals:false,skipZero:false,skipInactivePeriod:false};
  const args = {
    p_options:options,p_auxiliary:null,p_company:company.id,p_from:from,p_to:to,p_account:null,
    p_kind:partyId ? "client" : "all",p_party:partyId,p_currency:null,p_offset:0,
  };
  const queryArgs={...args,p_account:plan.action==="custom_ledger"?plan.accounts.join(",")||null:null};
  const result = await db.rpc("tw_finance_statement_snapshot", queryArgs);
  if (result.error) throw new Error("Accounting report unavailable.");
  const report = reportSchema.parse(result.data);
  const params = new URLSearchParams({company:company.id});
  if (year) params.set("year",year.id);
  const scope = `${company.name} · ${from} to ${to} · Journal dates · Posted transactions including unlocked entries · ${plan.display === "foreign" ? "Foreign currencies shown separately" : plan.display === "USD" ? "Second local: USD" : "Company base currency: " + company.base_currency}. ${plan.action === "pnl" ? "Closing entries excluded. Ledger-based income and expenses; completeness depends on recorded entries, not certified IFRS financial statements." : "Opening balances, debits, credits and closing balances from the accounting statement."} Report link opens the accounting screen; use the dates and display shown here.`;
  if(plan.action==="custom_ledger"){
    const rows=await readLedgerDetails(db,queryArgs,result.data);
    const columns=[...new Set(plan.columns)];
    if(!columns.includes("report_currency"))columns.push("report_currency");
    const captions:Record<string,string>={date:"Date",number:"JV",reference:"Reference",account:"Account",name:"Account name",description:"Description",party:"Party",report_currency:"Currency",debit:"Debit",credit:"Credit",balance:"Account balance"};
    return {title:plan.title,href:`/accounting?${params}#statements`,scope:scope+` Account prefixes: ${plan.accounts.join(", ")||"all"}. Balance is the running account balance within each currency, not a combined total.`,reportPlan:{...plan,from,to},
      tables:[{heading:plan.title,columns:columns.map(c=>captions[c]),rows:rows.map(row=>columns.map(c=>c==="party"?partyCode(row.party):String(row[c]??"")))}],facts:{company:company.name,from,to,count:rows.length,accounts:plan.accounts,columns}};
  }
  if (plan.action === "pnl") {
    const sections = financialReportSections({...report,auxiliaries:[]},setup.accounts,"profit",false,false);
    return {title:"Accounting Profit & Loss",href:`/accounting?${params}#financial-statements`,scope,tables:sections,reportPlan:{...plan,from,to},
      facts:{company:company.name,from,to,display:plan.display,sections}};
  }
  const groups = statementGroups({...report,rows:[],count:report.count??0} as Statement);
  const details=await readLedgerDetails(db,queryArgs,result.data);
  const document=statementDocument({...report,party:report.party?{code:report.party.code??undefined,address:report.party.address??undefined,taxId:report.party.taxId??undefined}:null,count:details.length,rows:details.map(r=>({...r,currency:r.currency??r.report_currency,auxiliary:r.auxiliary??null,foreign_debit:r.foreign_debit??null,foreign_credit:r.foreign_credit??null}))},{title:'Statement of Account',company:company.name,from,to,dateBasis:'Journal date',party:partyName??'',kind:'client',consolidate:true,details:true});
  return {title:`${partyName} — account statement`,href:`/accounting?${params}#client-statements`,scope,
    statementDocument:document,
    reportPlan:{...plan,from,to},tables:document.sections,
    facts:{company:company.name,client:partyName,from,to,display:plan.display,groups:groups.map(({currency,totals,accounts})=>({currency,totals,accounts}))}};
}
