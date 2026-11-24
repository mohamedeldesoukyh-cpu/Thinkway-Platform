import { z } from "zod";
import { cents, decimal } from "@/features/accounting/journal-model";
import type { AccountingSetup } from "@/features/accounting/setup-types";
import type { FinanceEvidence, FinancePlan } from "./contracts";
import type { FinanceReportClient } from "./report-tools";
import { readLedgerDetails, type LedgerRow } from "./ledger-details";

type Plan = Extract<FinancePlan,{action:"revenue_by_client"}> & {from:string;to:string};
const amount = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
const totalsSchema = z.object({accounts:z.array(z.object({currency:z.string(),debit:amount,credit:amount}))});
const clientsSchema = z.array(z.object({id:z.string(),code:z.string().nullable(),name:z.string()}));

/** Group exact snapshot amounts, including offsets and unassigned revenue; never model arithmetic. */
export function groupClientRevenue(rows:LedgerRow[], names:Map<string,string>){
  const currencies=new Map<string,Map<string,{debit:bigint;credit:bigint;count:number}>>();
  for(const row of rows){
    if(!row.transaction_type)throw Error("Transaction classification unavailable; cannot exclude closing entries.");
    if(row.transaction_type==="closing")continue;
    const clients=currencies.get(row.report_currency)??new Map();
    currencies.set(row.report_currency,clients);
    const code=row.party??"";
    const group=clients.get(code)??{debit:BigInt(0),credit:BigInt(0),count:0};
    group.debit+=cents(row.debit);group.credit+=cents(row.credit);group.count++;
    clients.set(code,group);
  }
  return [...currencies].sort(([a],[b])=>a.localeCompare(b)).map(([currency,clients])=>{
    const groups=[...clients].map(([code,g])=>({code,name:code?(names.get(code)??`Name unavailable (${code})`):"Unassigned client",...g}));
    groups.sort((a,b)=>{const difference=(b.credit-b.debit)-(a.credit-a.debit);return difference>BigInt(0)?1:difference<BigInt(0)?-1:a.code.localeCompare(b.code);});
    const total=groups.reduce((sum,g)=>sum+g.credit-g.debit,BigInt(0));
    return {currency,total,groups};
  });
}

export async function revenueByClient(db:FinanceReportClient,setup:AccountingSetup,plan:Plan,yearId:string|null):Promise<FinanceEvidence>{
  const company=setup.company!;
  // This is the platform's configured service-revenue group, not a model-invented filter.
  if(!setup.accounts.some(a=>a.code==="410000"&&a.type==="Revenue"&&a.kind==="Group"))throw Error("Service-revenue account group is not configured.");
  const args={p_company:company.id,p_from:plan.from,p_to:plan.to,p_account:"410000",p_kind:"all",p_party:null,p_currency:null,p_offset:0,p_auxiliary:null,
    p_options:{reportMode:"statement",dateBasis:"journal",display:plan.display,includeUnlocked:true,excludeClosing:false,skipZero:false}};
  // Both authenticated and delegated mail use the existing bounded, consistent snapshot.
  const result=await db.rpc("tw_finance_statement_snapshot",args);
  if(result.error)throw Error("Service-revenue report unavailable.");
  const rows=await readLedgerDetails(db,args,result.data);
  const control=totalsSchema.parse(result.data);
  const expected=new Map<string,bigint>();
  for(const account of control.accounts)expected.set(account.currency,(expected.get(account.currency)??BigInt(0))+cents(account.credit)-cents(account.debit));
  const actual=new Map<string,bigint>();
  for(const row of rows)actual.set(row.report_currency,(actual.get(row.report_currency)??BigInt(0))+cents(row.credit)-cents(row.debit));
  for(const currency of new Set([...expected.keys(),...actual.keys()])){
    if((actual.get(currency)??BigInt(0))!==(expected.get(currency)??BigInt(0)))throw Error("Revenue details do not reconcile to the ledger totals. Refresh the report.");
  }
  const names=new Map<string,string>();
  for(const code of new Set(rows.filter(r=>r.transaction_type!=="closing").map(r=>r.party).filter((code):code is string=>!!code))){
    const found=await db.rpc("tw_accounting_party_lookup",{p_company:company.id,p_kind:"client",p_search:code,p_selected:null});
    if(found.error)throw Error("Client directory unavailable.");
    const exact=clientsSchema.parse(found.data).filter(c=>c.code===code);
    if(exact.length===1)names.set(code,exact[0].name);
  }
  const grouped=groupClientRevenue(rows,names);
  const tables:NonNullable<FinanceEvidence["tables"]>=grouped.map(({currency,total,groups})=>({
    orientation:"portrait",heading:`Service revenue by client · ${currency}`,
    columns:["Client code","Client name","Net revenue amount"],
    rows:[...groups.map(g=>[g.code,g.name,decimal(g.credit-g.debit)]),["","Total",decimal(total)]],
  }));
  if(!tables.length)tables.push({orientation:"portrait",heading:"Service revenue by client",columns:["Client code","Client name","Net revenue amount"],rows:[]});
  if(plan.includeTransactions)for(const {currency} of grouped)tables.push({orientation:"landscape",heading:`Requested transaction detail · ${currency}`,columns:["Date","Document","Client code","Client name","Description","Debit","Credit"],rows:rows.filter(r=>r.report_currency===currency&&r.transaction_type!=="closing").map(r=>[r.date,r.document_number??r.number,r.party??"",r.party?(names.get(r.party)??"Name unavailable"):"Unassigned client",r.description,r.debit,r.credit])});
  const params=new URLSearchParams({company:company.id});if(yearId)params.set("year",yearId);
  return {title:"Service revenue by client",href:`/accounting?${params}#amgad`,reportPlan:plan,tables,
    scope:`${company.name} · ${plan.from} to ${plan.to} · Posted service-revenue ledger entries including unlocked entries. Net revenue = credits minus debits; adjustments and reversals retained, closing entries excluded. ${plan.display==="foreign"?"Currencies shown separately.":`Currency: ${plan.display==="USD"?"USD (second local)":company.base_currency}.`} Zero-net clients with activity are retained.`,
    facts:{company:company.name,from:plan.from,to:plan.to,transactionCount:rows.filter(r=>r.transaction_type!=="closing").length,groupedBy:"client",ledgerReconciled:true,includeTransactions:plan.includeTransactions,
      totals:grouped.map(g=>({currency:g.currency,netRevenue:decimal(g.total)})),clients:grouped.flatMap(g=>g.groups.map(c=>({code:c.code,name:c.name,currency:g.currency,netRevenue:decimal(c.credit-c.debit),transactionCount:c.count})))}};
}
